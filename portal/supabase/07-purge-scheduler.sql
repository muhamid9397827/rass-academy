
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create table if not exists app_private.asf_scheduler_keys(
 name text primary key check(name='purge'),
 secret text not null check(length(secret)>=48),
 created_at timestamptz not null default now()
);
insert into app_private.asf_scheduler_keys(name,secret)
values('purge',encode(gen_random_bytes(32),'hex'))
on conflict(name) do nothing;
revoke all on app_private.asf_scheduler_keys from public,anon,authenticated;

create or replace function public.asf_validate_purge_token(p_token text)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select length(coalesce(p_token,''))=64
 and exists(select 1 from app_private.asf_scheduler_keys where name='purge'
 and encode(digest(secret,'sha256'),'hex')=encode(digest(coalesce(p_token,''),'sha256'),'hex'));
$fn$;
revoke all on function public.asf_validate_purge_token(text) from public,anon,authenticated;
grant execute on function public.asf_validate_purge_token(text) to service_role;

create or replace function app_private.asf_run_purge_job()
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare req_id bigint;
begin
 select net.http_post(
 url:='https://sxtbgnjbrcsmgsdhkbno.supabase.co/functions/v1/asf-purge',
 headers:=jsonb_build_object('Authorization','Bearer '||(select secret from app_private.asf_scheduler_keys where name='purge'),'Content-Type','application/json'),
 body:='{}'::jsonb,timeout_milliseconds:=12000
 ) into req_id;
 return req_id;
end $fn$;
revoke all on function app_private.asf_run_purge_job() from public,anon,authenticated;

select cron.schedule('asf-purge-30-days','10 3 * * *',
 'select app_private.asf_run_purge_job();');
