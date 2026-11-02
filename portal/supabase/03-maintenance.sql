-- After schema.sql and 02-report-submission.sql.
-- Keep corrected reports valid when the original is purged after its retention period.
alter table public.asf_reports drop constraint if exists asf_reports_original_report_id_fkey;
alter table public.asf_reports add constraint asf_reports_original_report_id_fkey
 foreign key(original_report_id) references public.asf_reports(id) on delete set null;
-- With Supabase email webhooks and cleanup function, ensure webhook URLs and keys
-- are configured through dashboard secrets, NEVER in this repository.
