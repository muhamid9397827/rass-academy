-- Independent responsibilities. Authority is derived from server-owned rows,
-- never JWT user_metadata, ranks, browser state, or a submitted display name.
create table public.asf_responsibilities(
 user_id uuid not null references public.asf_profiles(user_id) on delete cascade,
 permission text not null check(permission in ('users.approve','academy.manage')),
 report_kind text check(report_kind is null),created_at timestamptz not null default now(),
 primary key(user_id,permission)
);
alter table public.asf_responsibilities enable row level security;
revoke all on public.asf_responsibilities from public,anon,authenticated;
grant select on public.asf_responsibilities to authenticated;
create policy "responsibilities self or commander" on public.asf_responsibilities for select to authenticated
 using(user_id=(select auth.uid()) or (select public.asf_is_commander()));

create or replace function public.asf_has_feature(feature text)
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and public.asf_approved()
 and feature in ('police.manage','court.manage','users.review','users.approve','academy.manage')
 and (exists(select 1 from public.asf_delegations d where d.user_id=auth.uid() and d.permission=feature) or exists(select 1 from public.asf_responsibilities d where d.user_id=auth.uid() and d.permission=feature)); $$;
revoke all on function public.asf_has_feature(text) from public,anon;
grant execute on function public.asf_has_feature(text) to authenticated;

create or replace function public.asf_set_delegation(target uuid,feature text,kind text,enabled boolean)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.asf_is_commander() then raise exception 'Commander only'; end if;
 if target is null or feature is null or enabled is null
 or feature not in ('reports.read','reports.review','police.manage','court.manage','users.review','users.approve','academy.manage')
 or (kind is not null and (feature not in ('reports.read','reports.review') or kind not in ('personnel','officers','joint','presidencies')))
 then raise exception 'Invalid delegation'; end if;
 if not exists(select 1 from public.asf_profiles where user_id=target and status='approved') then raise exception 'Target must be approved'; end if;
 if feature in ('users.approve','academy.manage') then
  if enabled then insert into public.asf_responsibilities(user_id,permission) values(target,feature) on conflict do nothing;
  else delete from public.asf_responsibilities where user_id=target and permission=feature;end if;
 elsif enabled then
  insert into public.asf_delegations(user_id,permission,report_kind) values(target,feature,kind) on conflict do nothing;
 else
  delete from public.asf_delegations where user_id=target and permission=feature and report_kind is not distinct from kind;
 end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'delegation',target::text,jsonb_build_object('feature',feature,'kind',kind,'enabled',enabled));
end $$;
revoke all on function public.asf_set_delegation(uuid,text,text,boolean) from public,anon;
grant execute on function public.asf_set_delegation(uuid,text,text,boolean) to authenticated;

create or replace function public.asf_set_delegations(p_users uuid[],p_features text[],p_kind text,p_enabled boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare person uuid; capability text;
begin
 if auth.uid() is null or not public.asf_is_commander() then raise exception 'Commander only'; end if;
 if coalesce(array_length(p_users,1),0) not between 1 and 200 or coalesce(array_length(p_features,1),0) not between 1 and 7 then raise exception 'Choose members and permissions'; end if;
 for person in select distinct unnest(p_users) order by 1 loop
  for capability in select distinct unnest(p_features) order by 1 loop
   perform public.asf_set_delegation(person,capability,case when capability in ('reports.read','reports.review') then p_kind else null end,p_enabled);
  end loop;
  insert into public.asf_notifications(recipient_id,category,message)
  values(person,'access_decision','تم تحديث مسؤولياتك وصلاحياتك من القيادة.');
 end loop;
end $$;
revoke all on function public.asf_set_delegations(uuid[],text[],text,boolean) from public,anon;
grant execute on function public.asf_set_delegations(uuid[],text[],text,boolean) to authenticated;

-- Delegated admissions can only decide pending requests, never promote themselves,
-- reopen suspended accounts, alter ranks/court access, or grant any delegation.
create or replace function public.asf_admin_action(op text,target uuid,arg text default null)
returns text language plpgsql security definer set search_path=''
as $$
declare p public.asf_profiles%rowtype; result text; leader boolean:=public.asf_is_commander();
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not leader and (not public.asf_has_feature('users.approve') or op is null or op not in ('approve','reject') or target=auth.uid() or arg is not null)
 then raise exception 'Not authorized'; end if;
 select * into p from public.asf_profiles where user_id=target for update;
 if not found then raise exception 'User not found'; end if;
 if not leader and (p.status<>'pending' or exists(select 1 from app_private.commanders where user_id=target)) then raise exception 'Only pending admissions may be reviewed'; end if;
 if op='approve' then
  if p.status='approved' then return p.military_code; end if;
  if length(btrim(coalesce(p.activation_reason,'')))<10 then raise exception 'Activation reason required'; end if;
  result:=coalesce(p.military_code,'ASF-'||lpad(nextval('public.asf_military_seq'::regclass)::text,6,'0'));
  update public.asf_profiles set status='approved',military_code=result,updated_at=now() where user_id=target;
 elsif op in ('suspend','reject') then
  update public.asf_profiles set status=case when op='suspend' then 'suspended' else 'rejected' end,updated_at=now() where user_id=target;result:=op;
 elsif op in ('court_on','court_off') then
  update public.asf_profiles set court_enabled=(op='court_on'),updated_at=now() where user_id=target;result:=op;
 elsif op='rank' then
  if arg is null or arg not in ('جندي','جندي أول','عريف','وكيل رقيب','رقيب','رقيب أول','رئيس رقباء','ملازم','ملازم أول','نقيب','رائد','مقدم','عقيد','عميد','لواء','فريق','فريق أول') then raise exception 'Invalid rank'; end if;
  update public.asf_profiles set rank=arg,updated_at=now() where user_id=target;result:=arg;
 else raise exception 'Invalid operation'; end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),op,target::text,jsonb_build_object('argument',arg,'delegated',not leader));
 insert into public.asf_notifications(recipient_id,category,message)
 values(target,'access_decision',case when op='approve' then 'تم تفعيل حسابك ويمكنك دخول البوابة.' when op='reject' then 'تم رفض طلب العضوية.' else 'تم تحديث بيانات حسابك من القيادة.' end);
 return result;
end $$;
revoke all on function public.asf_admin_action(text,uuid,text) from public,anon;
grant execute on function public.asf_admin_action(text,uuid,text) to authenticated;

create policy "delegated admissions read pending profiles" on public.asf_profiles for select to authenticated
 using(status='pending' and (select public.asf_has_feature('users.approve')));

-- Police and court are distinct departments, including their server-side writes.
alter policy "approved may view police rules" on public.asf_police_overrides
 using((select public.asf_is_commander()) or (select public.asf_has_feature('police.manage')));
alter policy "court cases create" on public.asf_court_cases
 with check(submitted_by=(select auth.uid()) and ((select public.asf_is_commander()) or (select public.asf_has_feature('police.manage'))));
alter policy "court cases read" on public.asf_court_cases
 using((select public.asf_has_court()) or (submitted_by=(select auth.uid()) and (select public.asf_has_feature('police.manage'))));

alter table public.asf_academy_results add column is_test boolean not null default false;
alter table public.asf_academy_results add column delivered_at timestamptz;
alter table public.asf_academy_results add column delivered_by uuid references auth.users(id) on delete set null;
alter table public.asf_academy_results add column delivered_by_name text;
alter table public.asf_academy_results add column delivered_by_code text;
alter table public.asf_academy_results add constraint asf_delivery_consistent
 check((delivered_at is null and delivered_by_name is null and delivered_by_code is null)
 or (delivered_at is not null and delivered_by_name is not null and passed and not is_test));
-- Retain the one known, impossible-Discord synthetic operational test as evidence.
update public.asf_academy_results set is_test=true
 where discord_id='99999999999999999999' and trainee_name='اختبار تقني مؤقت' and course_id='operations';
create index asf_academy_pending_delivery on public.asf_academy_results(received_at desc) where passed and delivered_at is null and not is_test;
create policy "course leadership reads results" on public.asf_academy_results for select to authenticated
 using((select public.asf_is_commander()) or (select public.asf_has_feature('academy.manage')));
-- Existing grants remain SELECT only. No client can directly write delivery fields.
revoke insert,update,delete on public.asf_academy_results from anon,authenticated;

create or replace function public.asf_confirm_academy_delivery(p_result uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r public.asf_academy_results%rowtype; actor public.asf_profiles%rowtype; already boolean;
begin
 if auth.uid() is null or (not public.asf_is_commander() and not public.asf_has_feature('academy.manage')) then raise exception 'Course leadership required'; end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active membership required'; end if;
 select * into r from public.asf_academy_results where id=p_result for update;
 if not found or not r.passed or r.is_test then raise exception 'A genuine passed result is required'; end if;
 already:=r.delivered_at is not null;
 if not already then
  update public.asf_academy_results set delivered_at=clock_timestamp(),delivered_by=auth.uid(),
   delivered_by_name=actor.game_name,delivered_by_code=actor.military_code where id=p_result returning * into r;
  insert into public.asf_audit(actor_id,action,target_id,detail)
  values(auth.uid(),'academy_delivered',r.id::text,jsonb_build_object('receipt',r.receipt,'actor_name',actor.game_name,'actor_code',actor.military_code,'delivered_at',r.delivered_at));
 end if;
 return jsonb_build_object('already_delivered',already,'delivered_at',r.delivered_at,'delivered_by_name',r.delivered_by_name,'delivered_by_code',r.delivered_by_code,'receipt',r.receipt);
end $$;
revoke all on function public.asf_confirm_academy_delivery(uuid) from public,anon;
grant execute on function public.asf_confirm_academy_delivery(uuid) to authenticated;

alter table public.asf_notifications add column event_kind text;

-- Admissions notice fan-out never changes confidential-report recipients.
create or replace function public.asf_queue_notice() returns trigger
language plpgsql security definer set search_path=''
as $$
declare msg text; cat text;
begin
 if TG_TABLE_NAME='asf_profiles' then
  cat:='registration';msg:='طلب تسجيل حساب جديد بانتظار التفعيل';
  insert into public.asf_notifications(recipient_id,category,message)
  select user_id,cat,msg from (
   select user_id from app_private.commanders union
   select d.user_id from public.asf_responsibilities d join public.asf_profiles p using(user_id)
    where d.permission='users.approve' and p.status='approved'
  ) recipients;
  return NEW;
 elsif TG_TABLE_NAME='asf_reports' then
  if NEW.kind='secret' then cat:='secret_report';msg:='ورد تقرير سري للغاية إلى القائد';
  else cat:='report';msg:='ورد تقرير إداري جديد للمراجعة';end if;
 elsif TG_TABLE_NAME='asf_change_requests' then cat:='account_change';msg:='ورد طلب تعديل بيانات مستخدم';
 else return NEW;end if;
 insert into public.asf_notifications(recipient_id,category,message)
 select user_id,cat,msg from app_private.commanders;
 return NEW;
end $$;
revoke all on function public.asf_queue_notice() from public,anon,authenticated;

create table app_private.asf_course_email_outbox(
 id uuid primary key default gen_random_uuid(),result_id uuid not null references public.asf_academy_results(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),attempts integer not null default 0,next_attempt_at timestamptz not null default now(),
 claimed_at timestamptz,sent_at timestamptz,cancelled_at timestamptz,last_error text,
 unique(result_id,recipient_id)
);
revoke all on app_private.asf_course_email_outbox from public,anon,authenticated;
create index asf_course_email_due on app_private.asf_course_email_outbox(next_attempt_at) where sent_at is null and cancelled_at is null;

create or replace function app_private.asf_course_pass_notice() returns trigger
language plpgsql security definer set search_path=''
as $$
declare person uuid;
begin
 if not NEW.passed or NEW.is_test then return NEW;end if;
 for person in select user_id from app_private.commanders union
  select d.user_id from public.asf_responsibilities d join public.asf_profiles p using(user_id)
   where d.permission='academy.manage' and p.status='approved'
 loop
  insert into public.asf_notifications(recipient_id,category,event_kind,message)
  values(person,'account_change','academy_pass','اختبار جديد ناجح ('||NEW.receipt||'). يرجى مراجعة نتائج الدورات وتأكيد التسليم.');
  insert into app_private.asf_course_email_outbox(result_id,recipient_id) values(NEW.id,person) on conflict do nothing;
 end loop;
 begin perform app_private.asf_dispatch_email_outbox();exception when others then null;end;
 return NEW;
end $$;
revoke all on function app_private.asf_course_pass_notice() from public,anon,authenticated;
create trigger asf_course_pass_notice after insert on public.asf_academy_results for each row execute function app_private.asf_course_pass_notice();

create or replace function app_private.asf_course_responsibility_notice() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
 if NEW.permission='academy.manage' then
  insert into public.asf_notifications(recipient_id,category,event_kind,message)
  values(NEW.user_id,'account_change','academy_assigned','تم تكليفك بمتابعة نتائج الدورات وتأكيد تسليم الناجحين.');
 end if;
 return NEW;
end $$;
revoke all on function app_private.asf_course_responsibility_notice() from public,anon,authenticated;
create trigger asf_course_responsibility_notice after insert on public.asf_responsibilities for each row execute function app_private.asf_course_responsibility_notice();

-- Per-recipient delivery, rechecking live delegation before every send. The worker
-- receives no report fields, arbitrary destination address, or client-supplied name.
create or replace function public.asf_course_email_claim_due(p_limit integer default 10)
returns table(id uuid,receipt text,recipient text,claim_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
 update app_private.asf_course_email_outbox q set cancelled_at=now()
 where q.sent_at is null and q.cancelled_at is null and not exists(
  select 1 from public.asf_profiles p join auth.users u on u.id=p.user_id
  join public.asf_academy_results r on r.id=q.result_id
  where p.user_id=q.recipient_id and p.status='approved' and u.email_confirmed_at is not null
  and r.passed and not r.is_test and r.delivered_at is null
  and (exists(select 1 from app_private.commanders c where c.user_id=p.user_id)
   or exists(select 1 from public.asf_responsibilities d where d.user_id=p.user_id and d.permission='academy.manage'))
 );
 return query with due as (
  select q.id from app_private.asf_course_email_outbox q where q.sent_at is null and q.cancelled_at is null and q.next_attempt_at<=now()
   and (q.claimed_at is null or q.claimed_at<now()-interval '3 minutes')
   order by q.created_at limit least(greatest(coalesce(p_limit,10),1),20) for update skip locked
 ), claimed as (
  update app_private.asf_course_email_outbox q set claimed_at=clock_timestamp(),attempts=q.attempts+1 from due where q.id=due.id
  returning q.id,q.result_id,q.recipient_id,q.claimed_at
 ) select c.id,r.receipt,u.email::text,c.claimed_at from claimed c join public.asf_academy_results r on r.id=c.result_id join auth.users u on u.id=c.recipient_id;
end $$;
revoke all on function public.asf_course_email_claim_due(integer) from public,anon,authenticated;
grant execute on function public.asf_course_email_claim_due(integer) to service_role;

create or replace function public.asf_course_email_finish(p_id uuid,p_claim_at timestamptz,p_success boolean,p_error text default null)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 update app_private.asf_course_email_outbox set claimed_at=null,sent_at=case when p_success then now() else null end,
 last_error=case when p_success then null else left(coalesce(p_error,'delivery_failed'),300) end,
 next_attempt_at=case when p_success then next_attempt_at else now()+make_interval(mins=>least(1440,power(2,least(attempts,8))::integer)) end
 where id=p_id and claimed_at=p_claim_at and sent_at is null and cancelled_at is null;
 return found;
end $$;
revoke all on function public.asf_course_email_finish(uuid,timestamptz,boolean,text) from public,anon,authenticated;
grant execute on function public.asf_course_email_finish(uuid,timestamptz,boolean,text) to service_role;
