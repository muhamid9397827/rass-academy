-- Stage 1: detect commander safely before MFA enrollment (already provisioned).
create or replace function public.asf_commander_mfa_required()
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null
   and exists(select 1 from app_private.commanders where user_id=auth.uid()); $$;
revoke all on function public.asf_commander_mfa_required() from public,anon,authenticated;
grant execute on function public.asf_commander_mfa_required() to authenticated;

-- Stage 2 (apply AFTER shipping the Commander MFA enrollment and challenge UI):
-- Make the canonical commander authorization function require an aal2 JWT.
create or replace function public.asf_is_commander()
returns boolean language sql stable security definer set search_path=''
as $$
  select coalesce(auth.jwt()->>'aal','')='aal2'
   and exists (select 1 from app_private.commanders where user_id=auth.uid());
$$;
-- Existing grants on asf_is_commander are preserved.
