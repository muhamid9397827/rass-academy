
-- Qualification record: recruiting staff can review and confirm manual hiring, not regrade an exam.
alter table public.asf_academy_results
 add column if not exists qualification_reviewed_at timestamptz,
 add column if not exists qualification_reviewed_by uuid references auth.users(id) on delete set null,
 add column if not exists qualification_reviewed_by_name text,
 add column if not exists qualification_hired_at timestamptz,
 add column if not exists qualification_hired_by uuid references auth.users(id) on delete set null,
 add column if not exists qualification_hired_by_name text;
alter table public.asf_academy_results drop constraint if exists asf_qualification_review_consistent;
alter table public.asf_academy_results add constraint asf_qualification_review_consistent check(
 (qualification_reviewed_at is null and qualification_reviewed_by_name is null and qualification_hired_at is null and qualification_hired_by_name is null)
 or (qualification_reviewed_at is not null and qualification_reviewed_by_name is not null
 and (qualification_hired_at is null or (qualification_hired_at is not null and qualification_hired_by_name is not null and passed))
 and course_id='individual-qualification' and not is_test));
drop policy if exists "recruitment officers read qualification results" on public.asf_academy_results;
create policy "recruitment officers read qualification results" on public.asf_academy_results for select to authenticated
using(course_id='individual-qualification' and (public.asf_is_commander()
 or public.asf_department_has_role('recruitment','head')
 or public.asf_department_has_role('recruitment','trainer')));
CREATE OR REPLACE FUNCTION public.asf_recruitment_qualification_action(p_result uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.asf_academy_results%rowtype; actor public.asf_profiles%rowtype; already boolean:=false;
begin
 if auth.uid() is null or not (public.asf_is_commander()
  or public.asf_department_has_role('recruitment','head')
  or public.asf_department_has_role('recruitment','trainer')) then
  raise exception 'Recruitment leadership only';
 end if;
 if p_action not in ('review','hire') then raise exception 'Invalid action'; end if;
 select * into actor from public.asf_profiles where user_id=auth.uid() and status='approved';
 if not found then raise exception 'Active reviewer required'; end if;
 select * into r from public.asf_academy_results where id=p_result for update;
 if not found or r.course_id<>'individual-qualification' or r.is_test then
  raise exception 'Genuine qualification result required';
 end if;
 if p_action='review' then
  already:=r.qualification_reviewed_at is not null;
  if not already then
   update public.asf_academy_results set qualification_reviewed_at=clock_timestamp(),
    qualification_reviewed_by=auth.uid(),qualification_reviewed_by_name=actor.game_name
   where id=p_result returning * into r;
  end if;
 else
  if not r.passed then raise exception 'Failed result cannot be marked hired'; end if;
  if r.qualification_reviewed_at is null then raise exception 'Review the result first'; end if;
  already:=r.qualification_hired_at is not null;
  if not already then
   update public.asf_academy_results set qualification_hired_at=clock_timestamp(),
    qualification_hired_by=auth.uid(),qualification_hired_by_name=actor.game_name
   where id=p_result returning * into r;
  end if;
 end if;
 if not already then
  insert into public.asf_audit(actor_id,action,target_id,detail)
  values(auth.uid(),case when p_action='review' then 'qualification_reviewed' else 'qualification_hired' end,p_result::text,
   jsonb_build_object('receipt',r.receipt,'reviewer',actor.game_name,'course',r.course_id,'passed',r.passed,
   'note','Manual acknowledgement; not Discord verification or automatic role grant'));
 end if;
 return jsonb_build_object('already',already,'reviewed_by_name',r.qualification_reviewed_by_name,
  'reviewed_at',r.qualification_reviewed_at,'hired_by_name',r.qualification_hired_by_name,
  'hired_at',r.qualification_hired_at,'receipt',r.receipt);
end $function$


revoke all on function public.asf_recruitment_qualification_action(uuid,text) from public,anon,authenticated;
grant execute on function public.asf_recruitment_qualification_action(uuid,text) to authenticated;

-- Readers are tracked server-side: secret report receipts remain commander-only.
create table if not exists public.asf_report_receipts(
 report_id uuid not null references public.asf_reports(id) on delete cascade,
 viewer_id uuid not null references auth.users(id) on delete cascade,
 viewer_name text not null,
 viewer_unit text not null,
 first_opened_at timestamptz not null default now(),
 last_opened_at timestamptz not null default now(),
 open_count integer not null default 1 check(open_count between 1 and 1000000),
 received_at timestamptz,
 primary key(report_id,viewer_id));
create index if not exists asf_report_receipts_last_open on public.asf_report_receipts(report_id,last_opened_at desc);
alter table public.asf_report_receipts enable row level security;
revoke all on public.asf_report_receipts from public,anon,authenticated;
grant select on public.asf_report_receipts to authenticated;
drop policy if exists "report recipients and authors read nonsecret receipts" on public.asf_report_receipts;
create policy "report recipients and authors read nonsecret receipts" on public.asf_report_receipts
for select to authenticated using(
 viewer_id=auth.uid() or exists(select 1 from public.asf_reports r where r.id=report_id and
 ((r.kind='secret' and public.asf_is_commander()) or (r.kind<>'secret' and
 (r.author_id=auth.uid() or public.asf_is_commander() or public.asf_can_read_kind(r.kind) or public.asf_can_review_kind(r.kind))))));
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
               else 'الجهة المخولة بمراجعة التقارير' end;
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
  values(r.author_id,'reports','report_received','تم استلام تقريرك '||r.report_number::text||
   ' من قبل '||actor.game_name||' — '||v_unit||'.');
 end if;
 return jsonb_build_object('opened_at',rec.last_opened_at,'received_at',rec.received_at,
 'viewer_name',rec.viewer_name,'viewer_unit',rec.viewer_unit,'open_count',rec.open_count);
end $function$


revoke all on function public.asf_report_receipt(uuid,boolean) from public,anon,authenticated;
grant execute on function public.asf_report_receipt(uuid,boolean) to authenticated;
