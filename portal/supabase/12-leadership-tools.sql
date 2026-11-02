-- Fully functional scoped leadership tools; secret-report permissions remain strictly commander-only.
create or replace function public.asf_has_feature(feature text)
returns boolean language sql stable security definer set search_path=''
as $f$
 select auth.uid() is not null and public.asf_approved()
  and feature in ('police.manage','court.manage','users.review')
  and exists(select 1 from public.asf_delegations d
    where d.user_id=auth.uid() and d.permission=feature);
$f$;
revoke all on function public.asf_has_feature(text) from public,anon;
grant execute on function public.asf_has_feature(text) to authenticated;

create or replace function public.asf_has_court()
returns boolean language sql stable security definer set search_path=''
as $f$
 select public.asf_is_commander()
  or (public.asf_approved() and
     (exists(select 1 from public.asf_profiles where user_id=auth.uid() and court_enabled)
      or public.asf_has_feature('court.manage')));
$f$;
revoke all on function public.asf_has_court() from public,anon;
grant execute on function public.asf_has_court() to authenticated;

drop policy if exists "profiles self or commander" on public.asf_profiles;
create policy "profiles self or commander" on public.asf_profiles for select to authenticated
using(user_id=auth.uid() or public.asf_is_commander() or public.asf_has_feature('users.review'));
drop policy if exists "change requests read" on public.asf_change_requests;
create policy "change requests read" on public.asf_change_requests for select to authenticated
using(user_id=auth.uid() or public.asf_is_commander() or public.asf_has_feature('users.review'));

create table if not exists public.asf_police_overrides(
  rule_key text not null check(rule_key ~ '^[a-zA-Z0-9-]{2,100}$'),
  rank_key text not null check(length(trim(rank_key)) between 2 and 80),
  penalty text not null check(length(trim(penalty)) between 3 and 500),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (rule_key,rank_key)
);
alter table public.asf_police_overrides enable row level security;
drop policy if exists "approved may view police rules" on public.asf_police_overrides;
create policy "approved may view police rules" on public.asf_police_overrides
  for select to authenticated using(public.asf_approved() or public.asf_is_commander());
revoke all on public.asf_police_overrides from anon,authenticated;
grant select on public.asf_police_overrides to authenticated;

create or replace function public.asf_set_police_override(p_key text,p_rank text,p_penalty text)
returns void language plpgsql security definer set search_path=''
as $f$
begin
 if auth.uid() is null or (not public.asf_is_commander() and not public.asf_has_feature('police.manage'))
 then raise exception 'Not authorized'; end if;
 if p_key !~ '^[a-zA-Z0-9-]{2,100}$' or length(trim(coalesce(p_rank,''))) not between 2 and 80
 then raise exception 'Invalid rule'; end if;
 if nullif(trim(coalesce(p_penalty,'')),'') is null then
  delete from public.asf_police_overrides where rule_key=p_key and rank_key=p_rank;
 else
  if length(trim(p_penalty)) not between 3 and 500 then raise exception 'Invalid penalty'; end if;
  insert into public.asf_police_overrides(rule_key,rank_key,penalty,updated_by,updated_at)
   values(p_key,p_rank,trim(p_penalty),auth.uid(),now())
   on conflict (rule_key,rank_key) do update
    set penalty=excluded.penalty,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'police_rule_override',p_key,jsonb_build_object('rank',p_rank,'removed',trim(coalesce(p_penalty,''))=''));
end $f$;
revoke all on function public.asf_set_police_override(text,text,text) from public,anon;
grant execute on function public.asf_set_police_override(text,text,text) to authenticated;
