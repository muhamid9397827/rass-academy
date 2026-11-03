-- Allow the trusted server (service_role only) to resolve the one verified commander email
-- without storing a personal email in public GitHub or exposing auth.users to clients.
create or replace function public.asf_commander_email_for_delivery()
returns text language sql stable security definer set search_path=''
as $fn$
 select u.email
 from app_private.commanders c
 join auth.users u on u.id=c.user_id
 where u.email_confirmed_at is not null
 limit 1;
$fn$;
revoke all on function public.asf_commander_email_for_delivery() from public,anon,authenticated;
grant execute on function public.asf_commander_email_for_delivery() to service_role;
