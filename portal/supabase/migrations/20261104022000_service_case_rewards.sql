
-- Case-based rewards: non-automatic, never for drafts or unreviewed cases.
create table if not exists public.asf_service_rewards(
 id uuid primary key default gen_random_uuid(),
 department text not null check(department in ('police','court')),
 case_id uuid not null references public.asf_court_cases(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 actor_name text not null,
 actor_code text,
 subject_label text not null,
 amount bigint not null check((department='police' and amount=100000) or (department='court' and amount=150000)),
 earned_at timestamptz not null default now(),
 paid_at timestamptz,
 paid_by uuid references auth.users(id),
 paid_by_name text,
 constraint asf_service_reward_unique_case unique(department,case_id),
 constraint asf_service_reward_paid_consistent check(
 (paid_at is null and paid_by is null and paid_by_name is null) or
 (paid_at is not null and paid_by is not null and paid_by_name is not null)));
create index if not exists asf_service_rewards_actor_idx on public.asf_service_rewards(actor_id,earned_at desc);
alter table public.asf_service_rewards enable row level security;
revoke all on public.asf_service_rewards from public,anon,authenticated;
grant select on public.asf_service_rewards to authenticated;
drop policy if exists "service rewards actor and responsible leaders" on public.asf_service_rewards;
create policy "service rewards actor and responsible leaders" on public.asf_service_rewards for select to authenticated
using(actor_id=auth.uid() or public.asf_is_commander() or
 (department='police' and public.asf_is_police_head()));
CREATE OR REPLACE FUNCTION public.asf_service_reward_claim(p_case uuid, p_department text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.asf_court_cases%rowtype; d public.asf_court_decisions%rowtype;
 actor public.asf_profiles%rowtype; saved public.asf_service_rewards%rowtype;
 value bigint; is_new boolean:=false;
begin
 if auth.uid() is null or p_case is null or p_department not in ('police','court') then
  raise exception 'Valid authenticated reward request required';end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active approved member required';end if;
 select * into c from public.asf_court_cases where id=p_case;
 select * into d from public.asf_court_decisions where case_id=p_case;
 if c.id is null or d.case_id is null then
  raise exception 'Reward eligible only after a case has a recorded judicial decision';
 end if;
 if p_department='police' then
  if c.submitted_by<>auth.uid() or not(
   public.asf_has_feature('police.manage') or public.asf_is_police_head() or public.asf_is_commander()) then
   raise exception 'Police case author only';
  end if;
  value:=100000;
 else
  if d.decided_by<>auth.uid() or not public.asf_has_court() then
   raise exception 'Judicial decision author only';
  end if;
  value:=150000;
 end if;
 insert into public.asf_service_rewards(department,case_id,actor_id,actor_name,actor_code,subject_label,amount)
 values(p_department,p_case,auth.uid(),actor.game_name,actor.military_code,
  left(c.subject,200),value)
 on conflict(department,case_id) do nothing returning * into saved;
 is_new:=found;
 if not is_new then
  select * into saved from public.asf_service_rewards where department=p_department and case_id=p_case;
  if saved.actor_id<>auth.uid() then raise exception 'Already awarded to another performer';end if;
 else
  insert into public.asf_audit(actor_id,action,target_id,detail)
  values(auth.uid(),'service_reward_claimed',saved.id::text,
   jsonb_build_object('department',p_department,'case',p_case,'amount',value,'actor',actor.game_name));
 end if;
 return jsonb_build_object('reward_id',saved.id,'amount',saved.amount,'created',is_new,'paid_at',saved.paid_at);
end $function$


revoke all on function public.asf_service_reward_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.asf_service_reward_claim(uuid,text) to authenticated;
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
   (r.department='police' and public.asf_is_police_head())) then
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
end $function$


revoke all on function public.asf_service_reward_mark_paid(uuid) from public,anon,authenticated;
grant execute on function public.asf_service_reward_mark_paid(uuid) to authenticated;
