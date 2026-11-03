
-- Police chief role and two separately delegable internal permissions.
-- Internal portal permissions only: no Discord changes.
create table if not exists public.asf_police_heads (
 user_id uuid primary key references public.asf_profiles(user_id) on delete cascade,
 granted_by uuid references auth.users(id) on delete set null,
 granted_at timestamptz not null default now()
);
alter table public.asf_police_heads enable row level security;
revoke all on public.asf_police_heads from public, anon, authenticated;
grant select on public.asf_police_heads to authenticated;
drop policy if exists "police head self or commander" on public.asf_police_heads;
create policy "police head self or commander" on public.asf_police_heads
 for select to authenticated
 using(user_id=(select auth.uid()) or (select public.asf_is_commander()));

create or replace function public.asf_is_police_head()
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and public.asf_approved()
  and exists(select 1 from public.asf_police_heads h where h.user_id=auth.uid());
$$;
revoke all on function public.asf_is_police_head() from public, anon, authenticated;
grant execute on function public.asf_is_police_head() to authenticated;

create or replace function public.asf_police_set_head(p_user uuid,p_enable boolean)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.asf_is_commander() then
  raise exception 'Commander only'; end if;
 if p_user is null or p_enable is null or p_user=auth.uid()
  or exists(select 1 from app_private.commanders c where c.user_id=p_user)
  or not exists(select 1 from public.asf_profiles p where p.user_id=p_user and p.status='approved')
 then raise exception 'Approved non-commander member required'; end if;
 if p_enable then
  insert into public.asf_police_heads(user_id,granted_by) values(p_user,auth.uid()) on conflict do nothing;
 else
  delete from public.asf_police_heads where user_id=p_user;
 end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'police_head_role',p_user::text,jsonb_build_object('enabled',p_enable));
 insert into public.asf_notifications(recipient_id,category,message)
 values(p_user,'access_decision',case when p_enable then
 'تم تعيينك رئيسًا لقسم الشرطة العسكرية داخل البوابة.'
 else 'تم سحب رئاسة الشرطة العسكرية داخل البوابة.' end);
end;
$$;
revoke all on function public.asf_police_set_head(uuid,boolean) from public, anon, authenticated;
grant execute on function public.asf_police_set_head(uuid,boolean) to authenticated;

-- Return only the minimum display fields to chief/commander; don't reveal activation reasons or emails.
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

create or replace function public.asf_police_set_role(p_user uuid,p_role text,p_enable boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_feature text;
begin
 if auth.uid() is null or not(public.asf_is_commander() or public.asf_is_police_head())
 then raise exception 'Police leadership only'; end if;
 if p_user is null or p_user=auth.uid() or p_enable is null
   or p_role not in ('police','court')
   or exists(select 1 from app_private.commanders c where c.user_id=p_user)
   or not exists(select 1 from public.asf_profiles p where p.user_id=p_user and p.status='approved')
 then raise exception 'Invalid member or role'; end if;
 v_feature:=case p_role when 'police' then 'police.manage' when 'court' then 'court.manage' end;
 if p_enable then
  insert into public.asf_delegations(user_id,permission,report_kind)
   select p_user,v_feature,null
   where not exists(select 1 from public.asf_delegations d
     where d.user_id=p_user and d.permission=v_feature and d.report_kind is null);
 else
  delete from public.asf_delegations
   where user_id=p_user and permission=v_feature and report_kind is null;
 end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'police_role',p_user::text,jsonb_build_object('role',p_role,'enabled',p_enable));
 insert into public.asf_notifications(recipient_id,category,message)
 values(p_user,'access_decision',
  (case when p_enable then 'تم منحك ' else 'تم سحب ' end)||
  (case p_role when 'police' then 'رول الشرطة العسكرية' else 'رول مجلس القضاء' end)||
  ' داخل البوابة.');
end;
$$;
revoke all on function public.asf_police_set_role(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.asf_police_set_role(uuid,text,boolean) to authenticated;

-- Real full names: at least two alphabetic words, not a one-word nickname.
create or replace function public.asf_valid_full_name(p_name text)
returns boolean language sql immutable set search_path=''
as $$
 select char_length(btrim(coalesce(p_name,''))) between 5 and 80
 and btrim(coalesce(p_name,'')) ~ '^[[:alpha:]]{2,}([[:space:]]+[[:alpha:]]{2,})+$';
$$;
revoke all on function public.asf_valid_full_name(text) from public, anon, authenticated;
grant execute on function public.asf_valid_full_name(text) to authenticated;

create or replace function public.asf_guard_profile_name()
returns trigger language plpgsql set search_path=''
as $$
begin
 if tg_op='INSERT'
  or new.game_name is distinct from old.game_name
  or (new.status='approved' and old.status is distinct from 'approved')
 then
  if not public.asf_valid_full_name(new.game_name) then
   raise exception 'Full first and family name is required (two words or more)';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists asf_guard_profile_name on public.asf_profiles;
create trigger asf_guard_profile_name
 before insert or update of game_name,status on public.asf_profiles
 for each row execute function public.asf_guard_profile_name();

create or replace function public.asf_guard_change_name()
returns trigger language plpgsql set search_path=''
as $$
begin
 if not public.asf_valid_full_name(new.new_game_name) then
  raise exception 'Full first and family name is required (two words or more)';
 end if;
 return new;
end;
$$;
drop trigger if exists asf_guard_change_name on public.asf_change_requests;
create trigger asf_guard_change_name
 before insert or update of new_game_name on public.asf_change_requests
 for each row execute function public.asf_guard_change_name();

-- Keep existing judicial warning records unchanged; validate only new names or edits.
create or replace function public.asf_guard_warning_name()
returns trigger language plpgsql set search_path=''
as $$
begin
 if not public.asf_valid_full_name(new.player_name) then
  raise exception 'Full first and family name is required (two words or more)';
 end if;
 return new;
end;
$$;
drop trigger if exists asf_guard_warning_name on public.asf_court_warnings;
create trigger asf_guard_warning_name
 before insert or update of player_name on public.asf_court_warnings
 for each row execute function public.asf_guard_warning_name();

-- New warnings can store Discord ID for exact name + ID lookups.
alter table public.asf_court_warnings
 add column if not exists player_discord_id text;
alter table public.asf_court_warnings
 drop constraint if exists asf_warning_discord_format;
alter table public.asf_court_warnings
 add constraint asf_warning_discord_format
 check(player_discord_id is null or player_discord_id ~ '^[0-9]{15,22}$');
