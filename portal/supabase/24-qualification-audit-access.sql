-- Only expose audit labels and timestamps for authorized reviewers under existing RLS.
-- Deliberately do not grant SELECT on answers, hashes, or internal user IDs.
grant select (qualification_reviewed_at, qualification_reviewed_by_name,
  qualification_hired_at, qualification_hired_by_name)
 on public.asf_academy_results to authenticated;

-- A small index for the operational workflow history foreign key.
create index if not exists asf_operations_task_events_actor on public.asf_operations_task_events(actor_id);
