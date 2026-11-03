-- Durable email outbox: preserve registration and report notifications while email provider is unavailable.
create table if not exists app_private.asf_email_outbox(
 id uuid primary key default gen_random_uuid(),
 category text not null check(category in ('registration','report','secret_report')),
 event_id uuid not null,
 created_at timestamptz not null default now(),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 claimed_at timestamptz,
 sent_at timestamptz,
 last_error text,
 unique(category,event_id)
);
create index if not exists asf_email_outbox_due_idx
 on app_private.asf_email_outbox(next_attempt_at)
 where sent_at is null;
revoke all on app_private.asf_email_outbox from public,anon,authenticated;

create or replace function public.asf_email_claim_due(p_limit integer default 15)
returns table(id uuid,category text,claim_at timestamptz)
language sql security definer set search_path=''
as $fn$
 with due as (
  select q.id from app_private.asf_email_outbox q
  where q.sent_at is null and q.next_attempt_at <= now()
   and (q.claimed_at is null or q.claimed_at < now()-interval '3 minutes')
  order by q.created_at asc limit least(greatest(coalesce(p_limit,15),1),50)
  for update skip locked
 ), claimed as (
  update app_private.asf_email_outbox q set
   claimed_at=clock_timestamp(), attempts=q.attempts+1
  from due where due.id=q.id
  returning q.id,q.category,q.claimed_at
 )
 select c.id,c.category,c.claimed_at from claimed c;
$fn$;
revoke all on function public.asf_email_claim_due(integer) from public,anon,authenticated;
grant execute on function public.asf_email_claim_due(integer) to service_role;

create or replace function public.asf_email_finish(
 p_id uuid,p_claim_at timestamptz,p_success boolean,p_error text default null)
returns boolean language plpgsql security definer set search_path=''
as $fn$
begin
 if p_success then
  update app_private.asf_email_outbox set sent_at=now(),
   claimed_at=null,last_error=null
  where id=p_id and claimed_at=p_claim_at and sent_at is null;
 else
  update app_private.asf_email_outbox set claimed_at=null,
   last_error=left(coalesce(p_error,'delivery_failed'),300),
   next_attempt_at=now()+make_interval(mins=>least(1440,(power(2,least(attempts,8)))::integer))
  where id=p_id and claimed_at=p_claim_at and sent_at is null;
 end if;
 return found;
end $fn$;
revoke all on function public.asf_email_finish(uuid,timestamptz,boolean,text)
 from public,anon,authenticated;
grant execute on function public.asf_email_finish(uuid,timestamptz,boolean,text) to service_role;

create or replace function app_private.asf_dispatch_email_outbox()
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare request_id bigint;
begin
 select net.http_post(
  url:='https://sxtbgnjbrcsmgsdhkbno.supabase.co/functions/v1/asf-notify',
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-asf-webhook-secret',(select secret from app_private.asf_email_bridge_key where name='notify')),
  body:='{"type":"process_outbox"}'::jsonb,
  timeout_milliseconds:=20000
 ) into request_id;
 return request_id;
end $fn$;
revoke all on function app_private.asf_dispatch_email_outbox() from public,anon,authenticated;

create or replace function app_private.asf_queue_email_bridge()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare category_name text; v_event_id uuid;
begin
 if TG_TABLE_NAME='asf_reports' then
   category_name:=case when new.kind='secret' then 'secret_report' else 'report' end;
   v_event_id:=new.id;
 elsif TG_TABLE_NAME='asf_profiles' then
   category_name:='registration';
   v_event_id:=new.user_id;
 else return new; end if;
 insert into app_private.asf_email_outbox(category,event_id)
 values(category_name,v_event_id)
 on conflict(category,event_id) do nothing;
 begin
  perform app_private.asf_dispatch_email_outbox();
 exception when others then
  -- Never roll back a new user's signup or a report submission because email failed.
  null;
 end;
 return new;
end $fn$;
-- Existing two database triggers automatically use replaced trigger function.
revoke all on function app_private.asf_queue_email_bridge() from public,anon,authenticated;

-- Make sure the worker retries queued notifications after the provider key is installed.
select cron.schedule('asf-email-outbox-every-2min','*/2 * * * *',
 'select app_private.asf_dispatch_email_outbox();');
