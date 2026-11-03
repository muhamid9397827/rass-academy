-- 2026-11-03: isolated internal departments, instructor rewards and supervisor payout review.
-- No Discord server role changes or payment transfers occur. These are internal portal roles/ledger entries.
create table if not exists public.asf_department_roles(
 user_id uuid not null references public.asf_profiles(user_id) on delete cascade,
 department text not null check(department in ('training','recruitment')),
 role text not null check(role in ('member','trainer','head')),
 granted_by uuid references auth.users(id) on delete set null,
 granted_at timestamptz not null default now(),
 primary key(user_id,department,role)
);
alter table public.asf_department_roles enable row level security;
revoke all on public.asf_department_roles from public,anon,authenticated;
grant select on public.asf_department_roles to authenticated;

create or replace function public.asf_department_has_role(p_department text,p_role text)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and public.asf_approved()
 and p_department in ('training','recruitment') and p_role in ('member','trainer','head')
 and exists(select 1 from public.asf_department_roles r
  where r.user_id=auth.uid() and r.department=p_department and r.role=p_role);
$$;
revoke all on function public.asf_department_has_role(text,text) from public,anon,authenticated;
grant execute on function public.asf_department_has_role(text,text) to authenticated;

create or replace function public.asf_department_can_manage(p_department text)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and (public.asf_is_commander()
 or public.asf_department_has_role(p_department,'head'));
$$;
revoke all on function public.asf_department_can_manage(text) from public,anon,authenticated;
grant execute on function public.asf_department_can_manage(text) to authenticated;

drop policy if exists "department roles self or department head" on public.asf_department_roles;
create policy "department roles self or department head"
 on public.asf_department_roles for select to authenticated
 using(user_id=(select auth.uid()) or (select public.asf_is_commander())
       or (select public.asf_department_can_manage(department)));

-- Supervisors can find approved members to appoint as instructors.
-- Recruitment teachers can see only pending candidates; never secret reports.
drop policy if exists "department heads browse members and recruitment reviews pending" on public.asf_profiles;
create policy "department heads browse members and recruitment reviews pending"
 on public.asf_profiles for select to authenticated
 using(
  (status='approved' and ((select public.asf_department_can_manage('training'))
    or (select public.asf_department_can_manage('recruitment'))))
  or (status='pending' and ((select public.asf_department_has_role('recruitment','trainer'))
    or (select public.asf_department_can_manage('recruitment'))))
 );

create or replace function public.asf_department_set_role(
 p_user uuid,p_department text,p_role text,p_enable boolean
) returns void language plpgsql security definer set search_path=''
as $$
declare v_commander boolean := public.asf_is_commander();
begin
 if auth.uid() is null or p_user is null or p_enable is null
  or p_department not in ('training','recruitment')
  or p_role not in ('member','trainer','head') then raise exception 'Invalid role assignment'; end if;
 if not v_commander and not (
     p_role='trainer' and public.asf_department_has_role(p_department,'head')
 ) then raise exception 'Only this department head can appoint its instructors'; end if;
 if not exists(select 1 from public.asf_profiles p where p.user_id=p_user and p.status='approved')
   or exists(select 1 from app_private.commanders c where c.user_id=p_user)
 then raise exception 'Approved non-commander member required'; end if;
 if p_enable then
  insert into public.asf_department_roles(user_id,department,role,granted_by)
   values(p_user,p_department,p_role,auth.uid()) on conflict do nothing;
 else
  delete from public.asf_department_roles
    where user_id=p_user and department=p_department and role=p_role;
 end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
  values(auth.uid(),'department_role',p_user::text,
   jsonb_build_object('department',p_department,'role',p_role,'enabled',p_enable));
 insert into public.asf_notifications(recipient_id,category,message)
  values(p_user,'access_decision',
   (case when p_enable then 'تم منحك دور ' else 'تم سحب دور ' end)
   ||(case p_department when 'training' then 'كلية التدريب' else 'القبول والتجنيد' end)
   ||' — '||(case p_role when 'head' then 'الرئاسة' when 'trainer' then 'مدرب' else 'عضو' end));
end;
$$;
revoke all on function public.asf_department_set_role(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.asf_department_set_role(uuid,text,text,boolean) to authenticated;

create table if not exists public.asf_department_rewards(
 id uuid primary key default gen_random_uuid(),
 department text not null check(department in ('recruitment','training')),
 subject_id uuid not null,
 subject_label text not null,
 actor_id uuid not null references auth.users(id),
 actor_name text not null,
 actor_code text,
 amount bigint not null default 150000 check(amount=150000),
 earned_at timestamptz not null default now(),
 paid_at timestamptz,
 paid_by uuid references auth.users(id),
 constraint asf_department_reward_paid_consistency check(
  (paid_at is null and paid_by is null) or (paid_at is not null and paid_by is not null)
 ),
 unique(department,subject_id)
);
create index if not exists asf_department_rewards_actor on public.asf_department_rewards(actor_id,earned_at desc);
create index if not exists asf_department_rewards_pending on public.asf_department_rewards(department,earned_at desc) where paid_at is null;
alter table public.asf_department_rewards enable row level security;
revoke all on public.asf_department_rewards from public,anon,authenticated;
grant select on public.asf_department_rewards to authenticated;
drop policy if exists "reward actor or department head" on public.asf_department_rewards;
create policy "reward actor or department head" on public.asf_department_rewards
 for select to authenticated
 using(actor_id=(select auth.uid()) or (select public.asf_is_commander())
       or (select public.asf_department_can_manage(department)));

-- Recruitment acceptance is a single server transaction. Only trainer actions earn rewards.
create or replace function public.asf_recruitment_accept(p_user uuid)
returns text language plpgsql security definer set search_path=''
as $$
declare p public.asf_profiles%rowtype; actor public.asf_profiles%rowtype;
 v_is_trainer boolean; v_code text;
begin
 if auth.uid() is null or not(
  public.asf_is_commander() or public.asf_department_has_role('recruitment','head')
   or public.asf_department_has_role('recruitment','trainer')) then
  raise exception 'Recruitment team only'; end if;
 if p_user is null or p_user=auth.uid() or exists(select 1 from app_private.commanders where user_id=p_user)
 then raise exception 'Invalid applicant'; end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active membership required'; end if;
 select * into p from public.asf_profiles where user_id=p_user for update;
 if not found or p.status<>'pending' then raise exception 'Applicant must be pending'; end if;
 if char_length(btrim(coalesce(p.activation_reason,'')))<10 then raise exception 'Activation reason is missing'; end if;
 v_code:=coalesce(p.military_code,'ASF-'||lpad(nextval('public.asf_military_seq'::regclass)::text,6,'0'));
 update public.asf_profiles set status='approved',military_code=v_code,updated_at=now() where user_id=p_user;
 v_is_trainer:=public.asf_department_has_role('recruitment','trainer');
 if v_is_trainer then
  insert into public.asf_department_rewards(department,subject_id,subject_label,actor_id,actor_name,actor_code)
   values('recruitment',p_user,p.game_name,auth.uid(),actor.game_name,actor.military_code);
 end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
  values(auth.uid(),'recruitment_accepted',p_user::text,
   jsonb_build_object('accepted_by',actor.game_name,'military_code',v_code,'trainer_reward',v_is_trainer));
 insert into public.asf_notifications(recipient_id,category,message)
  values(p_user,'access_decision','تم قبولك من قسم القبول والتجنيد بواسطة '||actor.game_name||'.');
 return v_code;
end;
$$;
revoke all on function public.asf_recruitment_accept(uuid) from public,anon,authenticated;
grant execute on function public.asf_recruitment_accept(uuid) to authenticated;

-- Retain existing delivery semantics and receipt integrity while allowing trainers
-- to confirm role handover. Existing academy managers keep their old permission.
create or replace function public.asf_confirm_academy_delivery(p_result uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r public.asf_academy_results%rowtype; actor public.asf_profiles%rowtype;
 already boolean; reward_trainer boolean;
begin
 if auth.uid() is null or (not public.asf_is_commander()
   and not public.asf_has_feature('academy.manage')
   and not public.asf_department_has_role('training','head')
   and not public.asf_department_has_role('training','trainer'))
 then raise exception 'Training team only'; end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active membership required'; end if;
 select * into r from public.asf_academy_results where id=p_result for update;
 if not found or not r.passed or r.is_test then raise exception 'A genuine passed result is required'; end if;
 already:=r.delivered_at is not null;
 if not already then
  update public.asf_academy_results set delivered_at=clock_timestamp(),delivered_by=auth.uid(),
    delivered_by_name=actor.game_name,delivered_by_code=actor.military_code
    where id=p_result returning * into r;
  reward_trainer:=public.asf_department_has_role('training','trainer');
  if reward_trainer then
   insert into public.asf_department_rewards(department,subject_id,subject_label,actor_id,actor_name,actor_code)
   values('training',r.id,r.trainee_name||' — '||r.course_title,auth.uid(),actor.game_name,actor.military_code)
   on conflict(department,subject_id) do nothing;
  end if;
  insert into public.asf_audit(actor_id,action,target_id,detail)
   values(auth.uid(),'academy_delivered',r.id::text,
    jsonb_build_object('receipt',r.receipt,'actor_name',actor.game_name,
     'actor_code',actor.military_code,'delivered_at',r.delivered_at,'trainer_reward',reward_trainer));
 end if;
 return jsonb_build_object('already_delivered',already,'delivered_at',r.delivered_at,
   'delivered_by_name',r.delivered_by_name,'delivered_by_code',r.delivered_by_code,'receipt',r.receipt);
end;
$$;
revoke all on function public.asf_confirm_academy_delivery(uuid) from public,anon,authenticated;
grant execute on function public.asf_confirm_academy_delivery(uuid) to authenticated;

drop policy if exists "department teachers read course results" on public.asf_academy_results;
create policy "department teachers read course results"
 on public.asf_academy_results for select to authenticated
 using((select public.asf_department_has_role('training','trainer'))
   or (select public.asf_department_has_role('training','head')));

create or replace function public.asf_department_mark_paid(p_reward uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r public.asf_department_rewards%rowtype;
begin
 if auth.uid() is null or p_reward is null then raise exception 'Authentication required'; end if;
 select * into r from public.asf_department_rewards where id=p_reward for update;
 if not found then raise exception 'Reward not found'; end if;
 if not public.asf_department_can_manage(r.department) then raise exception 'Department head only'; end if;
 if r.actor_id=auth.uid() then raise exception 'Another supervisor must review your own reward'; end if;
 if r.paid_at is not null then raise exception 'Reward already marked paid'; end if;
 update public.asf_department_rewards set paid_at=clock_timestamp(),paid_by=auth.uid()
  where id=p_reward returning * into r;
 insert into public.asf_audit(actor_id,action,target_id,detail)
  values(auth.uid(),'department_reward_paid',p_reward::text,
   jsonb_build_object('department',r.department,'trainer',r.actor_id,'amount',r.amount));
 insert into public.asf_notifications(recipient_id,category,message)
  values(r.actor_id,'access_decision',
   'تم تسجيل صرف مكافأة قدرها 150,000 عن '||r.subject_label||'.');
 return jsonb_build_object('paid_at',r.paid_at,'amount',r.amount,'actor_name',r.actor_name);
end;
$$;
revoke all on function public.asf_department_mark_paid(uuid) from public,anon,authenticated;
grant execute on function public.asf_department_mark_paid(uuid) to authenticated;
