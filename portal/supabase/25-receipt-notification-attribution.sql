-- Applied to the existing ASF report-receipts schema in shared Supabase.
-- Keeps existing report-privacy checks, first/last openings and explicit acknowledgements.
-- Repairs notification category and records a specific department label for the recipient.
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
end $function$
;
