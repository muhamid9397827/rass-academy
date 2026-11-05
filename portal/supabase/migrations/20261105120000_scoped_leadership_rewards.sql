-- Complete the unified leadership boundary without changing commander powers.
-- Section heads may manage only their own non-leadership staff, while the
-- commander remains the only actor allowed to appoint or remove presidencies.

create or replace function public.asf_management_set_staff(
 p_user uuid,p_section text,p_enable boolean
)
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
   when 'court' then public.asf_is_court_head()
   else false end;
 end if;
 if not v_allow then raise exception 'Role grants require matching section head or commander'; end if;
 if p_section in ('training','recruitment') then
  if p_enable then
   insert into public.asf_department_roles(user_id,department,role,granted_by)
   values(p_user,p_section,'trainer',auth.uid()) on conflict do nothing;
  else
   delete from public.asf_department_roles
   where user_id=p_user and department=p_section and role='trainer';
  end if;
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

create or replace function public.asf_admin_action(op text,target uuid,arg text default null)
returns text language plpgsql security definer set search_path=''
as $$
declare p public.asf_profiles%rowtype;
 v_commander boolean:=public.asf_is_commander();
 v_head boolean:=public.asf_can_manage_members();
 v_admissions boolean:=public.asf_has_feature('users.approve');
 v_scoped_suspend boolean:=false;
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
  if op='reject' and not (v_commander or v_head or v_admissions)
  then raise exception 'Admission authority required'; end if;
  if op='suspend' and not v_commander then
   v_scoped_suspend:=
    (public.asf_department_has_role('training','head') and exists(
      select 1 from public.asf_department_roles r
      where r.user_id=target and r.department='training' and r.role='trainer'))
    or (public.asf_department_has_role('recruitment','head') and exists(
      select 1 from public.asf_department_roles r
      where r.user_id=target and r.department='recruitment' and r.role='trainer'))
    or (public.asf_is_police_head() and (
      exists(select 1 from public.asf_delegations d where d.user_id=target and d.permission='police.manage')
      or exists(select 1 from public.asf_responsibilities r where r.user_id=target and r.permission='police.manage')))
    or (public.asf_is_court_head() and (
      p.court_enabled
      or exists(select 1 from public.asf_delegations d where d.user_id=target and d.permission='court.manage')
      or exists(select 1 from public.asf_responsibilities r where r.user_id=target and r.permission='court.manage')));
   if not v_scoped_suspend then raise exception 'Section heads may deactivate their own staff only'; end if;
  end if;
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
 values(auth.uid(),op,target::text,jsonb_build_object(
  'delegated',not v_commander,'argument',arg,'previous_status',p.status,
  'scope_checked',case when op='suspend' then true else null end));
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

drop policy if exists "service rewards actor and responsible leaders" on public.asf_service_rewards;
create policy "service rewards actor and responsible leaders" on public.asf_service_rewards
for select to authenticated using(
 actor_id=(select auth.uid())
 or (select public.asf_is_commander())
 or (department='police' and (select public.asf_is_police_head()))
 or (department='court' and (select public.asf_is_court_head()))
);

create or replace function public.asf_service_reward_mark_paid(p_reward uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r public.asf_service_rewards%rowtype; actor public.asf_profiles%rowtype;
begin
 if auth.uid() is null or p_reward is null then raise exception 'Authentication required';end if;
 select * into r from public.asf_service_rewards where id=p_reward for update;
 if not found then raise exception 'Reward not found';end if;
 if not(public.asf_is_commander()
   or (r.department='police' and public.asf_is_police_head())
   or (r.department='court' and public.asf_is_court_head()))
 then raise exception 'Matching department leadership only'; end if;
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
end;
$$;
revoke all on function public.asf_service_reward_mark_paid(uuid) from public,anon,authenticated;
grant execute on function public.asf_service_reward_mark_paid(uuid) to authenticated;
