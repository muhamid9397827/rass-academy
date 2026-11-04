-- Qualification tests are reviewed by recruitment and never count as a training-course role delivery.
CREATE OR REPLACE FUNCTION public.asf_confirm_academy_delivery(p_result uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if not found or not r.passed or r.is_test or r.course_id='individual-qualification' then raise exception 'A genuine passed course result is required; recruitment qualification follows its separate review'; end if;
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
$function$
