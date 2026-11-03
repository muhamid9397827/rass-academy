-- Course leaders need result/delivery fields, never ingestion secrets or answers.
revoke select on public.asf_academy_results from authenticated;
grant select(id,receipt,course_id,course_title,trainee_name,trainee_rank,discord_id,assigned_rank,score,total,percentage,passed,visibility_count,identity_verified,received_at,legacy_status,legacy_updated_at,is_test,delivered_at,delivered_by,delivered_by_name,delivered_by_code) on public.asf_academy_results to authenticated;
-- Reaffirm the existing notification boundary; recipients may only mark read_at.
revoke update on public.asf_notifications from authenticated;
grant update(read_at) on public.asf_notifications to authenticated;
