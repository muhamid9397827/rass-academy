-- A designated military-police chief inherits police tools, but NEVER court permissions.
-- The chief can assign a separate court role to approved members via the audited RPC.
create or replace function public.asf_has_feature(feature text)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null
  and public.asf_approved()
  and feature in ('police.manage','court.manage','users.review','users.approve','academy.manage')
  and (
   (feature='police.manage' and public.asf_is_police_head())
   or exists(select 1 from public.asf_delegations d where d.user_id=auth.uid() and d.permission=feature)
   or exists(select 1 from public.asf_responsibilities r where r.user_id=auth.uid() and r.permission=feature)
  );
$$;

-- The role directory distinguishes police/court roles given through delegates from
-- older commander-set court_enabled access; visibility must not imply a role is revocable.
create or replace function public.asf_police_directory()
returns table(user_id uuid, game_name text, military_code text, rank text,
 police_role boolean, court_role boolean, police_head boolean)
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null or not (public.asf_is_commander() or public.asf_is_police_head())
 then raise exception 'Police leadership only'; end if;
 return query
 select p.user_id,p.game_name,p.military_code,p.rank,
  exists(select 1 from public.asf_delegations d where d.user_id=p.user_id and d.permission='police.manage'),
  exists(select 1 from public.asf_delegations d where d.user_id=p.user_id and d.permission='court.manage'),
  exists(select 1 from public.asf_police_heads h where h.user_id=p.user_id)
 from public.asf_profiles p
 where p.status='approved'
   and p.user_id<>auth.uid()
   and not exists(select 1 from app_private.commanders c where c.user_id=p.user_id)
 order by p.game_name
 limit 500;
end;
$$;
revoke all on function public.asf_police_directory() from public, anon, authenticated;
grant execute on function public.asf_police_directory() to authenticated;
