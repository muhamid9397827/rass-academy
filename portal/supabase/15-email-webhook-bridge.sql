-- Minimal-data email webhook bridge. Nothing confidential is sent over HTTP.
create table if not exists app_private.asf_email_bridge_key (
  name text primary key check(name='notify'),
  secret text not null check(length(secret)=64)
);
insert into app_private.asf_email_bridge_key(name,secret)
values('notify',encode(gen_random_bytes(32),'hex'))
on conflict(name) do nothing;
revoke all on app_private.asf_email_bridge_key from public,anon,authenticated;

create or replace function public.asf_check_email_webhook(p_token text)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select length(coalesce(p_token,''))=64 and exists(
 select 1 from app_private.asf_email_bridge_key
 where name='notify' and
 extensions.digest(secret,'sha256')=extensions.digest(coalesce(p_token,''),'sha256'));
$fn$;
revoke all on function public.asf_check_email_webhook(text) from public,anon,authenticated;
grant execute on function public.asf_check_email_webhook(text) to service_role;

create or replace function app_private.asf_queue_email_bridge()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare payload jsonb;
begin
 if TG_TABLE_NAME='asf_reports' then
  payload:=jsonb_build_object('type','INSERT','table','asf_reports','record',
    jsonb_build_object('kind',NEW.kind));
 elsif TG_TABLE_NAME='asf_profiles' then
  payload:=jsonb_build_object('type','INSERT','table','asf_profiles','record','{}'::jsonb);
 else
  return NEW;
 end if;
 perform net.http_post(
  url:='https://sxtbgnjbrcsmgsdhkbno.supabase.co/functions/v1/asf-notify',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'x-asf-webhook-secret',(select secret from app_private.asf_email_bridge_key where name='notify')),
  body:=payload,
  timeout_milliseconds:=10000
 );
 return NEW;
end $fn$;
revoke all on function app_private.asf_queue_email_bridge() from public,anon,authenticated;
drop trigger if exists asf_email_bridge_profiles on public.asf_profiles;
create trigger asf_email_bridge_profiles after insert on public.asf_profiles
for each row execute function app_private.asf_queue_email_bridge();
drop trigger if exists asf_email_bridge_reports on public.asf_reports;
create trigger asf_email_bridge_reports after insert on public.asf_reports
for each row execute function app_private.asf_queue_email_bridge();
