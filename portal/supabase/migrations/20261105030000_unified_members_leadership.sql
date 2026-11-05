-- Unified leadership and member access. Apply only after PR review.
-- Every authorization check runs in the database; the browser cannot promote leaders.
create table if not exists public.asf_court_heads(
 user_id uuid primary key references public.asf_profiles(user_id) on delete cascade,
 granted_by uuid references auth.users(id) on delete set null,
 granted_at timestamptz not null default now()
);
alter table public.asf_court_heads enable row level security;
revoke all on public.asf_court_heads from public,anon,authenticated;
grant select on public.asf_court_heads to authenticated;
drop policy if exists "court heads self or commander" on public.asf_court_heads;
create policy "court heads self or commander" on public.asf_court_heads
 for select to authenticated using(user_id=(select auth.uid()) or (select public.asf_is_commander()));

create or replace function public.asf_is_court_head()
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and public.asf_approved()
 and exists(select 1 from public.asf_court_heads h where h.user_id=auth.uid());
$$;
revoke all on function public.asf_is_court_head() from public,anon,authenticated;
grant execute on function public.asf_is_court_head() to authenticated;

-- The court head has operational police + judicial authority, but no personnel grant authority.
-- Police chiefs have police operational authority only, not judicial powers.
create or replace function public.asf_has_feature(feature text)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and public.asf_approved()
  and feature in ('police.manage','court.manage','users.review','users.approve','academy.manage')
  and (
   (feature='police.manage' and (public.asf_is_police_head() or public.asf_is_court_head()))
   or (feature='court.manage' and public.asf_is_court_head())
   or (feature in ('users.approve','users.review') and (
      public.asf_is_police_head() or public.asf_is_court_head()
      or public.asf_department_has_role('training','head')
      or public.asf_department_has_role('recruitment','head')))
   or exists(select 1 from public.asf_delegations d
    where d.user_id=auth.uid() and d.permission=feature)
   or exists(select 1 from public.asf_responsibilities r
    where r.user_id=auth.uid() and r.permission=feature)
  );
$$;
revoke all on function public.asf_has_feature(text) from public,anon,authenticated;
grant execute on function public.asf_has_feature(text) to authenticated;

create or replace function public.asf_can_manage_members()
returns boolean language sql stable security definer set search_path=''
as $$
 select public.asf_is_commander()
  or (public.asf_approved() and (
   public.asf_is_police_head() or public.asf_is_court_head()
   or public.asf_department_has_role('training','head')
   or public.asf_department_has_role('recruitment','head')));
$$;
revoke all on function public.asf_can_manage_members() from public,anon,authenticated;
grant execute on function public.asf_can_manage_members() to authenticated;

-- Directory returns only the data required by the management screen, with no email or secrets.
-- Delegated admissions-only members may see pending requests, not the entire roster.
create or replace function public.asf_management_directory()
returns table(
 user_id uuid,game_name text,rank text,military_code text,discord_id text,
 activation_reason text,status text,created_at timestamptz,
 training_head boolean,recruitment_head boolean,police_head boolean,court_head boolean,
 training_trainer boolean,recruitment_trainer boolean,police_staff boolean,court_staff boolean
)
language plpgsql stable security definer set search_path=''
as $$
declare v_full boolean:=public.asf_can_manage_members();
begin
 if auth.uid() is null or not (v_full or public.asf_has_feature('users.approve'))
 then raise exception 'Leadership access required'; end if;
 return query select p.user_id,p.game_name,p.rank,p.military_code,p.discord_id,
  p.activation_reason,p.status,p.created_at,
  exists(select 1 from public.asf_department_roles d where d.user_id=p.user_id and d.department='training' and d.role='head'),
  exists(select 1 from public.asf_department_roles d where d.user_id=p.user_id and d.department='recruitment' and d.role='head'),
  exists(select 1 from public.asf_police_heads h where h.user_id=p.user_id),
  exists(select 1 from public.asf_court_heads h where h.user_id=p.user_id),
  exists(select 1 from public.asf_department_roles d where d.user_id=p.user_id and d.department='training' and d.role='trainer'),
  exists(select 1 from public.asf_department_roles d where d.user_id=p.user_id and d.department='recruitment' and d.role='trainer'),
  (exists(select 1 from public.asf_delegations d where d.user_id=p.user_id and d.permission='police.manage')
   or exists(select 1 from public.asf_responsibilities d where d.user_id=p.user_id and d.permission='police.manage')),
  (p.court_enabled
   or exists(select 1 from public.asf_delegations d where d.user_id=p.user_id and d.permission='court.manage')
   or exists(select 1 from public.asf_responsibilities d where d.user_id=p.user_id and d.permission='court.manage'))
 from public.asf_profiles p
 where not exists(select 1 from app_private.commanders c where c.user_id=p.user_id)
  and (v_full or p.status='pending')
 order by p.created_at desc limit 700;
end;
$$;
revoke all on function public.asf_management_directory() from public,anon,authenticated;
grant execute on function public.asf_management_directory() to authenticated;

-- Only the original commander with AAL2 can assign the four presidencies.
create or replace function public.asf_management_set_head(p_user uuid,p_section text,p_enable boolean)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.asf_is_commander()
 then raise exception 'Commander only'; end if;
 if p_user is null or p_enable is null or p_section is null or p_section not in ('training','recruitment','police','court')
   or p_user=auth.uid()
   or exists(select 1 from app_private.commanders c where c.user_id=p_user)
   or not exists(select 1 from public.asf_profiles p where p.user_id=p_user and p.status='approved')
 then raise exception 'Approved non-commander member required'; end if;
 if p_section in ('training','recruitment') then
  if p_enable then
   insert into public.asf_department_roles(user_id,department,role,granted_by)
   values(p_user,p_section,'head',auth.uid()) on conflict do nothing;
  else
   delete from public.asf_department_roles where user_id=p_user and department=p_section and role='head';
  end if;
 elsif p_section='police' then
  if p_enable then
   insert into public.asf_police_heads(user_id,granted_by)
    values(p_user,auth.uid()) on conflict do nothing;
  else delete from public.asf_police_heads where user_id=p_user; end if;
 else
  if p_enable then
   insert into public.asf_court_heads(user_id,granted_by)
    values(p_user,auth.uid()) on conflict do nothing;
  else delete from public.asf_court_heads where user_id=p_user; end if;
 end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'section_head',p_user::text,
  jsonb_build_object('section',p_section,'enabled',p_enable));
 insert into public.asf_notifications(recipient_id,category,message)
 values(p_user,'access_decision',case when p_enable then
  'تم تعيينك في رئاسة ' else 'تم سحب رئاستك في ' end||
  case p_section when 'training' then 'كلية التدريب' when 'recruitment' then 'القبول والتجنيد'
   when 'police' then 'الشرطة العسكرية' else 'مجلس القضاء العسكري' end);
end;
$$;
revoke all on function public.asf_management_set_head(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.asf_management_set_head(uuid,text,boolean) to authenticated;

-- Staff grants live ONLY in the unified member center; no chief may appoint presidents.
-- Police chief may manage police staff only. Court head does not grant either role.
create or replace function public.asf_management_set_staff(p_user uuid,p_section text,p_enable boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_allow boolean:=public.asf_is_commander();
 v_feature text;
begin
 if auth.uid() is null or p_user is null or p_enable is null
  or p_section is null or p_section not in ('training','recruitment','police','court')
  or p_user=auth.uid()
  or exists(select 1 from app_private.commanders c where c.user_id=p_user)
  or not exists(select 1 from public.asf_profiles p where p.user_id=p_user and p.status='approved')
 then raise exception 'Approved non-commander member required'; end if;
 if not v_allow then
  v_allow:=case p_section
   when 'training' then public.asf_department_has_role('training','head')
   when 'recruitment' then public.asf_department_has_role('recruitment','head')
   when 'police' then public.asf_is_police_head()
   else false end;
 end if;
 if not v_allow then raise exception 'Role grants require section head or commander'; end if;
 if p_section in ('training','recruitment') then
  if p_enable then
   insert into public.asf_department_roles(user_id,department,role,granted_by)
   values(p_user,p_section,'trainer',auth.uid()) on conflict do nothing;
  else delete from public.asf_department_roles
   where user_id=p_user and department=p_section and role='trainer'; end if;
 else
  v_feature:=case p_section when 'police' then 'police.manage' else 'court.manage' end;
  if p_enable then
   insert into public.asf_delegations(user_id,permission,report_kind)
    select p_user,v_feature,null
    where not exists(select 1 from public.asf_delegations d
      where d.user_id=p_user and d.permission=v_feature and d.report_kind is null);
  else
   delete from public.asf_delegations where user_id=p_user and permission=v_feature;
   delete from public.asf_responsibilities where user_id=p_user and permission=v_feature;
   if p_section='court' then
    update public.asf_profiles set court_enabled=false,updated_at=now() where user_id=p_user;
   end if;
  end if;
 end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'section_staff',p_user::text,
  jsonb_build_object('section',p_section,'enabled',p_enable));
 insert into public.asf_notifications(recipient_id,category,message)
 values(p_user,'access_decision',
  (case when p_enable then 'تم منحك صلاحية العمل في ' else 'تم سحب صلاحية العمل في ' end)||
  case p_section when 'training' then 'كلية التدريب' when 'recruitment' then 'القبول والتجنيد'
  when 'police' then 'الشرطة العسكرية' else 'مجلس القضاء العسكري' end);
end;
$$;
revoke all on function public.asf_management_set_staff(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.asf_management_set_staff(uuid,text,boolean) to authenticated;

-- Disable alternate staff-role mutation paths; keep historical records intact.
create or replace function public.asf_police_set_role(p_user uuid,p_role text,p_enable boolean)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if p_role is null or p_role not in ('police','court') then raise exception 'Invalid section'; end if;
 perform public.asf_management_set_staff(p_user,p_role,p_enable);
end;
$$;
revoke all on function public.asf_police_set_role(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.asf_police_set_role(uuid,text,boolean) to authenticated;

create or replace function public.asf_department_set_role(p_user uuid,p_department text,p_role text,p_enable boolean)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if p_role='head' then
  perform public.asf_management_set_head(p_user,p_department,p_enable);
 elsif p_role='trainer' then
  perform public.asf_management_set_staff(p_user,p_department,p_enable);
 else raise exception 'Only trainer or commander-assigned presidency is supported'; end if;
end;
$$;
revoke all on function public.asf_department_set_role(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.asf_department_set_role(uuid,text,text,boolean) to authenticated;

-- Change an account's internal access, preserve its audit history and reports,
-- and revoke *every* portal grant in the same transaction.
create or replace function public.asf_admin_action(op text,target uuid,arg text default null)
returns text language plpgsql security definer set search_path=''
as $$
declare p public.asf_profiles%rowtype;
 v_commander boolean:=public.asf_is_commander();
 v_head boolean:=public.asf_can_manage_members();
 v_admissions boolean:=public.asf_has_feature('users.approve');
 v_result text;
begin
 if auth.uid() is null or target is null or op is null or target=auth.uid()
   or exists(select 1 from app_private.commanders where user_id=target)
 then raise exception 'Invalid target or identity'; end if;
 select * into p from public.asf_profiles where user_id=target for update;
 if not found then raise exception 'Account not found'; end if;
 if op in ('rank','court_on','court_off') then
  if not v_commander then raise exception 'Commander only'; end if;
  if op='rank' then
   if arg is null or arg not in ('جندي','جندي أول','عريف','وكيل رقيب','رقيب','رقيب أول','رئيس رقباء','ملازم','ملازم أول','نقيب','رائد','مقدم','عقيد','عميد','لواء','فريق','فريق أول')
   then raise exception 'Invalid rank'; end if;
   update public.asf_profiles set rank=arg,updated_at=now() where user_id=target;
   v_result:=arg;
  else
   update public.asf_profiles set court_enabled=(op='court_on'),updated_at=now() where user_id=target;
   v_result:=op;
  end if;
 elsif op='approve' then
  if not (v_commander or v_head or v_admissions) then raise exception 'Admission authority required'; end if;
  if p.status<>'pending' and not v_commander then raise exception 'Only commander can reactivate accounts'; end if;
  if p.status not in ('pending','rejected','suspended') then raise exception 'Account already active'; end if;
  if char_length(btrim(coalesce(p.activation_reason,'')))<10 then raise exception 'Activation reason required'; end if;
  if not exists(select 1 from auth.users u where u.id=target and u.email_confirmed_at is not null)
  then raise exception 'Email confirmation required'; end if;
  if exists(select 1 from public.asf_profiles q where q.user_id<>target and q.discord_id=p.discord_id and q.status='approved')
  then raise exception 'Discord identifier already approved'; end if;
  v_result:=coalesce(p.military_code,'ASF-'||lpad(nextval('public.asf_military_seq'::regclass)::text,6,'0'));
  update public.asf_profiles set status='approved',military_code=v_result,updated_at=now() where user_id=target;
 elsif op in ('reject','suspend') then
  if not (v_commander or v_head or (v_admissions and op='reject')) then
   raise exception 'Leadership authority required'; end if;
  if (op='reject' and p.status<>'pending') or (op='suspend' and p.status<>'approved')
  then raise exception 'Action does not match account status'; end if;
  if not v_commander and (
   exists(select 1 from public.asf_police_heads h where h.user_id=target)
   or exists(select 1 from public.asf_court_heads h where h.user_id=target)
   or exists(select 1 from public.asf_department_roles h where h.user_id=target and h.role='head'))
  then raise exception 'Only commander may deactivate leadership'; end if;
  update public.asf_profiles set status=case when op='reject' then 'rejected' else 'suspended' end,
   court_enabled=false,updated_at=now() where user_id=target;
  delete from public.asf_delegations where user_id=target;
  delete from public.asf_responsibilities where user_id=target;
  delete from public.asf_department_roles where user_id=target;
  delete from public.asf_police_heads where user_id=target;
  delete from public.asf_court_heads where user_id=target;
  v_result:=op;
 else raise exception 'Invalid operation'; end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),op,target::text,jsonb_build_object('delegated',not v_commander,'argument',arg,'previous_status',p.status));
 insert into public.asf_notifications(recipient_id,category,message)
 values(target,'access_decision',
  case when op='approve' then 'تم تفعيل عضويتك في البوابة.'
   when op='reject' then 'تم رفض طلب العضوية.'
   when op='suspend' then 'تم إلغاء تفعيل حسابك وسحب صلاحياتك من بوابة أمن المنشآت.'
   else 'تم تعديل بيانات حسابك من القيادة.' end);
 return v_result;
end;
$$;
revoke all on function public.asf_admin_action(text,uuid,text) from public,anon,authenticated;
grant execute on function public.asf_admin_action(text,uuid,text) to authenticated;

-- Suspended or rejected accounts remain able to sign into Supabase Auth until
-- the separate privileged Auth-ban function completes. RLS rejects portal access meanwhile.

-- The Auth ban/unban Edge Function calls this as the ORIGINAL authenticated actor.
-- Never trust client-provided target, role, status, or permission assertions.
create or replace function public.asf_auth_ban_allowed(p_target uuid,p_mode text)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and p_target is not null
  and p_target<>auth.uid()
  and p_mode in ('ban','unban')
  and not exists(select 1 from app_private.commanders c where c.user_id=p_target)
  and exists(select 1 from public.asf_profiles p where p.user_id=p_target
   and ((p_mode='ban' and p.status in ('rejected','suspended')
      and (public.asf_can_manage_members() or public.asf_has_feature('users.approve')))
    or (p_mode='unban' and p.status='approved' and public.asf_is_commander())));
$$;
revoke all on function public.asf_auth_ban_allowed(uuid,text) from public,anon,authenticated;
grant execute on function public.asf_auth_ban_allowed(uuid,text) to authenticated;

-- No employee, court member, or police chief can grant judicial personnel roles.
-- Legacy police directory stays read-only for clients; all role writes go through
-- the scoped asf_management_set_staff RPC.

-- Restrict recruitment records to recruitment and the commander, not course trainers.
drop policy if exists "department teachers read course results" on public.asf_academy_results;
create policy "department teachers read course results" on public.asf_academy_results
 for select to authenticated using(
  course_id<>'individual-qualification'
  and ((select public.asf_department_has_role('training','trainer'))
   or (select public.asf_department_has_role('training','head')))
 );
drop policy if exists "course leadership reads results" on public.asf_academy_results;
create policy "course leadership reads results" on public.asf_academy_results
 for select to authenticated using(
  (select public.asf_is_commander())
  or (course_id<>'individual-qualification' and (select public.asf_has_feature('academy.manage')))
 );

-- Trainers may review course outcomes separately from confirming delivery.
alter table public.asf_academy_results
 add column if not exists training_reviewed_at timestamptz,
 add column if not exists training_reviewed_by uuid references auth.users(id) on delete set null,
 add column if not exists training_reviewed_by_name text;
-- Only safe display fields are directly readable; reviewer IDs stay private.
grant select(training_reviewed_at,training_reviewed_by_name) on public.asf_academy_results to authenticated;

create or replace function public.asf_training_review_result(p_result uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r public.asf_academy_results%rowtype;
 actor public.asf_profiles%rowtype;
 v_already boolean;
begin
 if auth.uid() is null or not (public.asf_is_commander()
  or public.asf_has_feature('academy.manage')
  or public.asf_department_has_role('training','head')
  or public.asf_department_has_role('training','trainer'))
 then raise exception 'Training review authority required'; end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Approved trainer required'; end if;
 select * into r from public.asf_academy_results where id=p_result for update;
 if not found or r.is_test or r.course_id='individual-qualification'
 then raise exception 'Genuine course result required'; end if;
 v_already:=r.training_reviewed_at is not null;
 if not v_already then
  update public.asf_academy_results
  set training_reviewed_at=clock_timestamp(),
      training_reviewed_by=auth.uid(),training_reviewed_by_name=actor.game_name
  where id=p_result returning * into r;
  insert into public.asf_audit(actor_id,action,target_id,detail)
  values(auth.uid(),'training_result_reviewed',p_result::text,
   jsonb_build_object('receipt',r.receipt,'reviewer',actor.game_name,'passed',r.passed));
 end if;
 return jsonb_build_object('already',v_already,'reviewed_at',r.training_reviewed_at,
 'reviewed_by_name',r.training_reviewed_by_name,'receipt',r.receipt);
end;
$$;
revoke all on function public.asf_training_review_result(uuid) from public,anon,authenticated;
grant execute on function public.asf_training_review_result(uuid) to authenticated;

-- Preliminary recruitment acceptance is an explicit decision, not hiring and not
-- an automatic membership activation. Only genuine passed/reviewed results qualify.
alter table public.asf_academy_results
 add column if not exists qualification_preliminary_at timestamptz,
 add column if not exists qualification_preliminary_by uuid references auth.users(id) on delete set null,
 add column if not exists qualification_preliminary_by_name text;
grant select(qualification_preliminary_at,qualification_preliminary_by_name) on public.asf_academy_results to authenticated;

create or replace function public.asf_recruitment_qualification_action(p_result uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r public.asf_academy_results%rowtype;
 actor public.asf_profiles%rowtype;
 v_already boolean:=false;
begin
 if auth.uid() is null or not (public.asf_is_commander()
  or public.asf_department_has_role('recruitment','head')
  or public.asf_department_has_role('recruitment','trainer'))
 then raise exception 'Recruitment reviewer only'; end if;
 if p_action is null or p_action not in ('review','preliminary','hire') then raise exception 'Invalid action'; end if;
 if p_action='hire' and not (public.asf_is_commander() or public.asf_department_has_role('recruitment','head')) then
  raise exception 'Final hiring is restricted to recruitment leadership'; end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active reviewer required'; end if;
 select * into r from public.asf_academy_results where id=p_result for update;
 if not found or r.course_id<>'individual-qualification' or r.is_test then
  raise exception 'Genuine qualification result required'; end if;
 if p_action='review' then
  v_already:=r.qualification_reviewed_at is not null;
  if not v_already then
   update public.asf_academy_results set qualification_reviewed_at=clock_timestamp(),
     qualification_reviewed_by=auth.uid(),qualification_reviewed_by_name=actor.game_name
   where id=p_result returning * into r;
  end if;
 elsif p_action='preliminary' then
  if not r.passed or r.qualification_reviewed_at is null then
   raise exception 'Only reviewed successful results can receive preliminary acceptance'; end if;
  v_already:=r.qualification_preliminary_at is not null;
  if not v_already then
   update public.asf_academy_results set qualification_preliminary_at=clock_timestamp(),
     qualification_preliminary_by=auth.uid(),qualification_preliminary_by_name=actor.game_name
   where id=p_result returning * into r;
  end if;
 else
  -- Legacy explicit hiring records stay supported; never inferred from preliminary acceptance.
  if not r.passed or r.qualification_reviewed_at is null then raise exception 'Passed reviewed result required'; end if;
   if r.qualification_hired_at is null and r.qualification_preliminary_at is null
   then raise exception 'Preliminary acceptance required before final hiring'; end if;
  v_already:=r.qualification_hired_at is not null;
  if not v_already then
   update public.asf_academy_results set qualification_hired_at=clock_timestamp(),
     qualification_hired_by=auth.uid(),qualification_hired_by_name=actor.game_name
   where id=p_result returning * into r;
  end if;
 end if;
 if not v_already then
  insert into public.asf_audit(actor_id,action,target_id,detail)
  values(auth.uid(),case p_action when 'review' then 'qualification_reviewed'
    when 'preliminary' then 'qualification_preliminary' else 'qualification_hired' end,
    p_result::text,jsonb_build_object('receipt',r.receipt,'reviewer',actor.game_name,
    'passed',r.passed,'not_automatic_role_grant',true));
 end if;
 return jsonb_build_object('already',v_already,'receipt',r.receipt,
  'reviewed_at',r.qualification_reviewed_at,'reviewed_by_name',r.qualification_reviewed_by_name,
  'preliminary_at',r.qualification_preliminary_at,'preliminary_by_name',r.qualification_preliminary_by_name,
  'hired_at',r.qualification_hired_at,'hired_by_name',r.qualification_hired_by_name);
end;
$$;
revoke all on function public.asf_recruitment_qualification_action(uuid,text) from public,anon,authenticated;
grant execute on function public.asf_recruitment_qualification_action(uuid,text) to authenticated;

-- Existing standalone recruitment RPC must not bypass the new centralized membership
-- admission boundary merely because a user has a trainer role.
create or replace function public.asf_recruitment_accept(p_user uuid)
returns text language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not (public.asf_is_commander()
   or public.asf_department_has_role('recruitment','head'))
 then raise exception 'Admission through leadership center only'; end if;
 return public.asf_admin_action('approve',p_user,null);
end;
$$;
revoke all on function public.asf_recruitment_accept(uuid) from public,anon,authenticated;
grant execute on function public.asf_recruitment_accept(uuid) to authenticated;


-- Training review and role delivery are separate, ordered acknowledgements.
-- Preserve past delivery records; only new confirmations require review.
create or replace function public.asf_confirm_academy_delivery(p_result uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r public.asf_academy_results%rowtype;
 actor public.asf_profiles%rowtype;
 already boolean; reward_trainer boolean;
begin
 if auth.uid() is null or not (
   public.asf_is_commander()
   or public.asf_has_feature('academy.manage')
   or public.asf_department_has_role('training','head')
   or public.asf_department_has_role('training','trainer'))
 then raise exception 'Training team only'; end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active membership required'; end if;
 select * into r from public.asf_academy_results where id=p_result for update;
 if not found or not r.passed or r.is_test or r.course_id='individual-qualification'
 then raise exception 'A genuine passed training course is required'; end if;
 already:=r.delivered_at is not null;
 if not already then
  if r.training_reviewed_at is null then raise exception 'Review the training result before delivery'; end if;
  update public.asf_academy_results
  set delivered_at=clock_timestamp(),delivered_by=auth.uid(),
      delivered_by_name=actor.game_name,delivered_by_code=actor.military_code
  where id=p_result returning * into r;
  reward_trainer:=public.asf_department_has_role('training','trainer');
  if reward_trainer then
   insert into public.asf_department_rewards(department,subject_id,subject_label,actor_id,actor_name,actor_code)
   values('training',r.id,r.trainee_name||' — '||r.course_title,
    auth.uid(),actor.game_name,actor.military_code)
   on conflict(department,subject_id) do nothing;
  end if;
  insert into public.asf_audit(actor_id,action,target_id,detail)
  values(auth.uid(),'academy_delivered',r.id::text,
   jsonb_build_object('receipt',r.receipt,'actor_name',actor.game_name,
    'actor_code',actor.military_code,'delivered_at',r.delivered_at,
    'reviewed_at',r.training_reviewed_at,'trainer_reward',reward_trainer));
 end if;
 return jsonb_build_object('already_delivered',already,'delivered_at',r.delivered_at,
   'delivered_by_name',r.delivered_by_name,'delivered_by_code',r.delivered_by_code,'receipt',r.receipt);
end;
$$;
revoke all on function public.asf_confirm_academy_delivery(uuid) from public,anon,authenticated;
grant execute on function public.asf_confirm_academy_delivery(uuid) to authenticated;

-- Unify court-presidency operational authority and attribution.
CREATE OR REPLACE FUNCTION public.asf_report_receipt(p_report uuid, p_received boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.asf_reports%rowtype; actor public.asf_profiles%rowtype;
 v_unit text; old_received timestamptz; rec public.asf_report_receipts%rowtype;
begin
 if auth.uid() is null or p_report is null then raise exception 'Sign in required'; end if;
 select * into r from public.asf_reports where id=p_report and deleted_at is null;
 if not found then raise exception 'Report unavailable'; end if;
 if not(public.asf_is_commander() or
     (r.kind<>'secret' and (public.asf_can_read_kind(r.kind) or public.asf_can_review_kind(r.kind)))) then
  raise exception 'Report receipt restricted to authorized reviewers';
 end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active reviewer required'; end if;
 v_unit:=case when public.asf_is_commander() then 'قيادة أمن المنشآت'
               when public.asf_is_court_head() then 'رئاسة مجلس القضاء العسكري'
               when public.asf_is_police_head() then 'رئاسة الشرطة العسكرية'
               when public.asf_department_has_role('training','head') then 'رئاسة كلية التدريب'
               when public.asf_department_has_role('recruitment','head') then 'رئاسة القبول والتجنيد'
               when public.asf_department_has_role('training','trainer') then 'كلية التدريب'
               when public.asf_department_has_role('recruitment','trainer') then 'القبول والتجنيد'
               when public.asf_has_feature('police.manage') then 'الشرطة العسكرية'
               when public.asf_has_feature('court.manage') then 'مجلس القضاء'
               else 'الجهة المفوضة بمراجعة التقارير' end;
 select received_at into old_received from public.asf_report_receipts
 where report_id=p_report and viewer_id=auth.uid();
 insert into public.asf_report_receipts(report_id,viewer_id,viewer_name,viewer_unit,received_at)
 values(p_report,auth.uid(),actor.game_name,v_unit,
        case when p_received then clock_timestamp() else null end)
 on conflict(report_id,viewer_id) do update set
  last_opened_at=clock_timestamp(),open_count=least(public.asf_report_receipts.open_count+1,1000000),
  received_at=case when p_received then coalesce(public.asf_report_receipts.received_at,clock_timestamp())
   else public.asf_report_receipts.received_at end
 returning * into rec;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),case when p_received then 'report_received' else 'report_opened' end,p_report::text,
  jsonb_build_object('actor',actor.game_name,'unit',v_unit,'kind',r.kind,'opens',rec.open_count));
 if p_received and old_received is null and r.kind<>'secret' and r.author_id<>auth.uid() then
  insert into public.asf_notifications(recipient_id,category,event_kind,message)
  values(r.author_id,'report','report_received','تم استلام تقريرك '||r.report_number::text||
   ' من قبل '||actor.game_name||' — '||v_unit||'.');
 end if;
 return jsonb_build_object('opened_at',rec.last_opened_at,'received_at',rec.received_at,
 'viewer_name',rec.viewer_name,'viewer_unit',rec.viewer_unit,'open_count',rec.open_count);
end $function$;

revoke all on function public.asf_report_receipt(uuid,boolean) from public,anon,authenticated;
grant execute on function public.asf_report_receipt(uuid,boolean) to authenticated;

-- Unify court-presidency operational authority and attribution.
CREATE OR REPLACE FUNCTION public.asf_service_reward_mark_paid(p_reward uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.asf_service_rewards%rowtype; actor public.asf_profiles%rowtype;
begin
 if auth.uid() is null or p_reward is null then raise exception 'Authentication required';end if;
 select * into r from public.asf_service_rewards where id=p_reward for update;
 if not found then raise exception 'Reward not found';end if;
 if not(public.asf_is_commander() or
   (r.department='police' and (public.asf_is_police_head() or public.asf_is_court_head()))) then
  raise exception 'Authorized leadership only';
 end if;
 if r.actor_id=auth.uid() then raise exception 'Another leader must verify own bonus';end if;
 if r.paid_at is not null then raise exception 'Reward already paid';end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active leader required';end if;
 update public.asf_service_rewards set paid_at=clock_timestamp(),paid_by=auth.uid(),
  paid_by_name=actor.game_name where id=p_reward returning * into r;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'service_reward_paid',p_reward::text,
  jsonb_build_object('department',r.department,'case',r.case_id,'amount',r.amount,'approved_by',actor.game_name));
 insert into public.asf_notifications(recipient_id,category,message)
 values(r.actor_id,'access_decision','تم توثيق صرف مكافأة عملك ('||r.amount::text||') عن قضية '||r.subject_label||'.');
 return jsonb_build_object('paid_at',r.paid_at,'paid_by_name',r.paid_by_name,'amount',r.amount);
end $function$;

revoke all on function public.asf_service_reward_mark_paid(uuid) from public,anon,authenticated;
grant execute on function public.asf_service_reward_mark_paid(uuid) to authenticated;


-- Keep department role grants in the central member management workflow.
CREATE OR REPLACE FUNCTION public.asf_request_access(p_permission text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid := auth.uid(); v_id uuid; v_reason text := btrim(coalesce(p_reason,''));
begin
 if v_user is null or not public.asf_approved() or public.asf_is_commander() then
  raise exception 'Only approved members can request access';
 end if;
 if p_permission is null or p_permission not in
  ('reports.read','reports.review','users.review')
 then raise exception 'Invalid permission requested'; end if;
 if char_length(v_reason) < 8 or char_length(v_reason) > 400
 then raise exception 'Reason must be 8 to 400 characters'; end if;
 if exists(select 1 from public.asf_delegations d
   where d.user_id=v_user and d.permission=p_permission and d.report_kind is null)
   or (p_permission='court.manage' and exists(
     select 1 from public.asf_profiles p where p.user_id=v_user and p.court_enabled))
 then raise exception 'You already have this permission'; end if;
 if exists(select 1 from public.asf_access_requests r
  where r.user_id=v_user and r.permission=p_permission and r.status='pending')
 then raise exception 'A request for this permission is already pending'; end if;
 if (select count(*) from public.asf_access_requests r
      where r.user_id=v_user and r.created_at > now()-interval '24 hours') >= 3
 then raise exception 'You have reached the daily request limit'; end if;

 insert into public.asf_access_requests(user_id,permission,reason)
 values(v_user,p_permission,v_reason) returning id into v_id;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(v_user,'access_requested',v_id::text,jsonb_build_object('permission',p_permission));
 insert into public.asf_notifications(recipient_id,category,message)
 select c.user_id,'access_request',
   'طلب تصريح جديد: '||coalesce(p.game_name,'عضو')||' — '||p_permission
 from app_private.commanders c
 join public.asf_profiles p on p.user_id=v_user;
 return v_id;
end;
$function$;
revoke all on function public.asf_request_access(text,text) from public,anon,authenticated;
grant execute on function public.asf_request_access(text,text) to authenticated;

-- Keep department role grants in the central member management workflow.
CREATE OR REPLACE FUNCTION public.asf_review_access_request(p_request uuid, p_allow boolean, p_note text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_request public.asf_access_requests%rowtype; v_note text := btrim(coalesce(p_note,''));
begin
 if auth.uid() is null or not public.asf_is_commander()
 then raise exception 'Commander only'; end if;
 if p_request is null or p_allow is null
 then raise exception 'Invalid decision'; end if;
 if char_length(v_note)>400 then raise exception 'Decision note too long'; end if;
 select * into v_request from public.asf_access_requests
 where id=p_request for update;
 if not found then raise exception 'Request not found'; end if;
 if v_request.status<>'pending' then raise exception 'Request already reviewed'; end if;
 if p_allow and v_request.permission in ('police.manage','court.manage') then
  raise exception 'Department staff roles must be assigned from the unified member center';
 end if;
 if p_allow then
  perform public.asf_set_delegation(v_request.user_id,v_request.permission,null,true);
 end if;
 update public.asf_access_requests
 set status=case when p_allow then 'approved' else 'rejected' end,
  reviewed_by=auth.uid(), reviewed_at=now(), decision_note=v_note
 where id=p_request;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'access_reviewed',p_request::text,
   jsonb_build_object('permission',v_request.permission,'approved',p_allow,'user_id',v_request.user_id));
 insert into public.asf_notifications(recipient_id,category,message)
 values(v_request.user_id,'access_decision',
  case when p_allow then 'تمت الموافقة على طلب التصريح: ' else 'تم رفض طلب التصريح: ' end
  ||v_request.permission);
end;
$function$;
revoke all on function public.asf_review_access_request(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.asf_review_access_request(uuid,boolean,text) to authenticated;
