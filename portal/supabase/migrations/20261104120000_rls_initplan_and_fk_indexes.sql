-- Keep ASF authorization predicates unchanged while letting Postgres evaluate
-- caller identity and zero-argument authorization helpers once per statement.
-- This addresses Supabase's auth_rls_initplan advisory without widening access.

drop policy if exists "delegations self or commander" on public.asf_delegations;
create policy "delegations self or commander" on public.asf_delegations
for select to authenticated
using ((user_id = (select auth.uid())) or (select public.asf_is_commander()));

drop policy if exists "drafts own" on public.asf_drafts;
create policy "drafts own" on public.asf_drafts
for all to authenticated
using ((author_id = (select auth.uid())) and (select public.asf_approved()))
with check ((author_id = (select auth.uid())) and (select public.asf_approved()));

drop policy if exists "reports approved submit" on public.asf_reports;
create policy "reports approved submit" on public.asf_reports
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (select public.asf_approved())
  and pdf_path like ((select auth.uid())::text || '/%')
  and sender_code = (
    select p.military_code from public.asf_profiles p
    where p.user_id = (select auth.uid()) and p.status = 'approved'
  )
  and sender_name = (
    select p.game_name from public.asf_profiles p
    where p.user_id = (select auth.uid()) and p.status = 'approved'
  )
  and sender_rank = (
    select p.rank from public.asf_profiles p
    where p.user_id = (select auth.uid()) and p.status = 'approved'
  )
);

drop policy if exists "reports restricted read" on public.asf_reports;
create policy "reports restricted read" on public.asf_reports
for select to authenticated
using (
  (kind = 'secret' and (select public.asf_is_commander()))
  or (
    kind <> 'secret'
    and (
      (select public.asf_is_commander())
      or (
        deleted_at is null
        and (select public.asf_approved())
        and (
          author_id = (select auth.uid())
          or public.asf_can_read_kind(kind)
          or public.asf_can_review_kind(kind)
        )
      )
    )
  )
);

drop policy if exists "change requests create" on public.asf_change_requests;
create policy "change requests create" on public.asf_change_requests
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select public.asf_approved())
  and state = 'pending'
  and reviewed_at is null
);

drop policy if exists "change requests read" on public.asf_change_requests;
create policy "change requests read" on public.asf_change_requests
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.asf_is_commander())
  or (select public.asf_has_feature('users.review'))
);

drop policy if exists "court decisions create" on public.asf_court_decisions;
create policy "court decisions create" on public.asf_court_decisions
for insert to authenticated
with check ((select public.asf_has_court()) and decided_by = (select auth.uid()));

drop policy if exists "court members add warnings" on public.asf_court_warnings;
create policy "court members add warnings" on public.asf_court_warnings
for insert to authenticated
with check (
  (select public.asf_has_court())
  and recorded_by = (select auth.uid())
  and cancelled_at is null
);

drop policy if exists "recipient may read notices" on public.asf_notifications;
create policy "recipient may read notices" on public.asf_notifications
for select to authenticated
using (recipient_id = (select auth.uid()));

drop policy if exists "recipient may mark notices" on public.asf_notifications;
create policy "recipient may mark notices" on public.asf_notifications
for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

drop policy if exists "profiles self or commander" on public.asf_profiles;
create policy "profiles self or commander" on public.asf_profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.asf_is_commander())
  or (select public.asf_has_feature('users.review'))
);

drop policy if exists "report recipients and authors read nonsecret receipts" on public.asf_report_receipts;
create policy "report recipients and authors read nonsecret receipts" on public.asf_report_receipts
for select to authenticated
using (
  viewer_id = (select auth.uid())
  or exists (
    select 1 from public.asf_reports r
    where r.id = asf_report_receipts.report_id
      and (
        (r.kind = 'secret' and (select public.asf_is_commander()))
        or (
          r.kind <> 'secret'
          and (
            r.author_id = (select auth.uid())
            or (select public.asf_is_commander())
            or public.asf_can_read_kind(r.kind)
            or public.asf_can_review_kind(r.kind)
          )
        )
      )
  )
);

drop policy if exists "service rewards actor and responsible leaders" on public.asf_service_rewards;
create policy "service rewards actor and responsible leaders" on public.asf_service_rewards
for select to authenticated
using (
  actor_id = (select auth.uid())
  or (select public.asf_is_commander())
  or (department = 'police' and (select public.asf_is_police_head()))
);

-- Cover the foreign keys used by the portal's recurring user queues and RLS
-- joins. They also make parent deletes avoid full-table scans.
create index if not exists asf_notifications_recipient_created_idx
  on public.asf_notifications(recipient_id, created_at desc);
create index if not exists asf_reports_author_submitted_idx
  on public.asf_reports(author_id, submitted_at desc);
create index if not exists asf_drafts_author_updated_idx
  on public.asf_drafts(author_id, updated_at desc);
create index if not exists asf_change_requests_user_created_idx
  on public.asf_change_requests(user_id, created_at desc);
create index if not exists asf_report_receipts_viewer_opened_idx
  on public.asf_report_receipts(viewer_id, last_opened_at desc);
create index if not exists asf_court_cases_submitter_created_idx
  on public.asf_court_cases(submitted_by, created_at desc);
create index if not exists asf_court_warnings_case_recorded_idx
  on public.asf_court_warnings(case_id, recorded_at desc);
