-- Secure operational tasks. Only the commander assigns work; assignees can update status.
create table if not exists public.asf_operations_tasks(
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(btrim(title)) between 4 and 180),
 description text not null default '' check(char_length(description)<=4000),
 created_by uuid not null references auth.users(id),
 created_by_name text not null,
 assigned_to uuid not null references auth.users(id),
 assigned_to_name text not null,
 priority text not null default 'normal' check(priority in ('normal','high','urgent')),
 status text not null default 'new' check(status in ('new','in_progress','blocked','done')),
 reference_code text not null default '' check(char_length(reference_code)<=100),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz
);
create index if not exists asf_operations_tasks_assignee on public.asf_operations_tasks(assigned_to,status,created_at desc);
create index if not exists asf_operations_tasks_creator on public.asf_operations_tasks(created_by,created_at desc);
alter table public.asf_operations_tasks enable row level security;
revoke all on public.asf_operations_tasks from public,anon,authenticated;
grant select on public.asf_operations_tasks to authenticated;
drop policy if exists "operations participants read own work" on public.asf_operations_tasks;
create policy "operations participants read own work" on public.asf_operations_tasks
 for select to authenticated
 using(created_by=(select auth.uid()) or assigned_to=(select auth.uid()) or (select public.asf_is_commander()));

create table if not exists public.asf_operations_task_events(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.asf_operations_tasks(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 actor_name text not null,
 action text not null check(action in ('created','status')),
 previous_status text,
 next_status text,
 note text not null default '' check(char_length(note)<=1000),
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists asf_operations_task_events_task on public.asf_operations_task_events(task_id,created_at desc);
alter table public.asf_operations_task_events enable row level security;
revoke all on public.asf_operations_task_events from public,anon,authenticated;
grant select on public.asf_operations_task_events to authenticated;
drop policy if exists "operations participants read history" on public.asf_operations_task_events;
create policy "operations participants read history" on public.asf_operations_task_events
 for select to authenticated using(exists(select 1 from public.asf_operations_tasks t
 where t.id=task_id and (t.created_by=(select auth.uid()) or t.assigned_to=(select auth.uid())
 or (select public.asf_is_commander()))));

create or replace function public.asf_create_operation_task(
 p_title text,p_description text,p_assignee uuid,p_priority text default 'normal',p_reference_code text default ''
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare creator public.asf_profiles%rowtype; assignee public.asf_profiles%rowtype; task_id uuid;
begin
 if auth.uid() is null or not public.asf_is_commander() then raise exception 'Commander only'; end if;
 select * into creator from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active commander profile required'; end if;
 select * into assignee from public.asf_profiles where user_id=p_assignee and status='approved';
 if not found then raise exception 'Assignee must be an approved member'; end if;
 if char_length(btrim(coalesce(p_title,''))) not between 4 and 180
  or char_length(coalesce(p_description,''))>4000
  or p_priority not in ('normal','high','urgent')
  or char_length(coalesce(p_reference_code,''))>100 then raise exception 'Invalid task fields';end if;
 insert into public.asf_operations_tasks(title,description,created_by,created_by_name,assigned_to,assigned_to_name,priority,reference_code)
 values(btrim(p_title),coalesce(p_description,''),auth.uid(),creator.game_name,p_assignee,assignee.game_name,p_priority,coalesce(p_reference_code,''))
 returning id into task_id;
 insert into public.asf_operations_task_events(task_id,actor_id,actor_name,action,next_status)
 values(task_id,auth.uid(),creator.game_name,'created','new');
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'operation_task_created',task_id::text,jsonb_build_object('assignee',p_assignee,'priority',p_priority));
 if p_assignee<>auth.uid() then
  insert into public.asf_notifications(recipient_id,category,event_kind,message)
  values(p_assignee,'account_change','operation_task_assigned','تم تكليفك بمهمة جديدة: '||left(btrim(p_title),150));
 end if;
 return task_id;
end;
$function$;
revoke all on function public.asf_create_operation_task(text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.asf_create_operation_task(text,text,uuid,text,text) to authenticated;

create or replace function public.asf_update_operation_task(p_task uuid,p_status text,p_note text default '')
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare t public.asf_operations_tasks%rowtype; actor public.asf_profiles%rowtype; clean_note text;
begin
 if auth.uid() is null or p_task is null then raise exception 'Authentication required';end if;
 if p_status not in ('new','in_progress','blocked','done') then raise exception 'Invalid status';end if;
 clean_note:=btrim(coalesce(p_note,''));
 if char_length(clean_note)>1000 then raise exception 'Note too long';end if;
 select * into t from public.asf_operations_tasks where id=p_task for update;
 if not found or not(t.assigned_to=auth.uid() or t.created_by=auth.uid() or public.asf_is_commander()) then
  raise exception 'Task not found or not authorized';end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active member required';end if;
 if t.status=p_status and clean_note='' then raise exception 'No change to record';end if;
 if t.status='done' and p_status<>'done' and not public.asf_is_commander()
  then raise exception 'Only the commander can reopen completed work'; end if;
 update public.asf_operations_tasks set status=p_status,updated_at=clock_timestamp(),
  completed_at=case when p_status='done' then coalesce(completed_at,clock_timestamp()) else null end where id=p_task;
 insert into public.asf_operations_task_events(task_id,actor_id,actor_name,action,previous_status,next_status,note)
 values(p_task,auth.uid(),actor.game_name,'status',t.status,p_status,clean_note);
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'operation_task_status',p_task::text,jsonb_build_object('before',t.status,'after',p_status,'actor',actor.game_name));
 if t.created_by<>auth.uid() then
  insert into public.asf_notifications(recipient_id,category,event_kind,message)
  values(t.created_by,'account_change','operation_task_updated','تم تحديث المهمة "'||left(t.title,120)||'" بواسطة '||actor.game_name||'.');
 end if;
 return jsonb_build_object('id',p_task,'status',p_status,'actor',actor.game_name);
end;
$function$;
revoke all on function public.asf_update_operation_task(uuid,text,text) from public,anon,authenticated;
grant execute on function public.asf_update_operation_task(uuid,text,text) to authenticated;
