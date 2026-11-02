-- Preserve the full timeline of report review decisions and commander directives.
create table if not exists public.asf_review_history(
 id bigint generated always as identity primary key,
 report_id uuid not null references public.asf_reports(id) on delete cascade,
 state text not null check(state in ('new','reviewing','reviewed','needs_more')),
 note text not null default '',
 reviewed_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists asf_review_history_report_idx
 on public.asf_review_history(report_id,created_at desc);
alter table public.asf_review_history enable row level security;
drop policy if exists "read history of visible reports" on public.asf_review_history;
create policy "read history of visible reports"
on public.asf_review_history for select to authenticated
using(exists(select 1 from public.asf_reports r where r.id=report_id));
revoke all on public.asf_review_history from public,anon,authenticated;
grant select on public.asf_review_history to authenticated;
-- Only authoritative RPC can append history; users can never update/delete entries.
create or replace function public.asf_review_report(report uuid,new_state text,new_note text)
returns void language plpgsql security definer set search_path=''
as $fn$
declare r_kind text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select kind into r_kind from public.asf_reports where id=report and deleted_at is null;
 if not found then raise exception 'Report unavailable'; end if;
 if not public.asf_is_commander() and not public.asf_can_review_kind(r_kind)
 then raise exception 'Not authorized'; end if;
 if new_state not in ('new','reviewing','reviewed','needs_more') then
  raise exception 'Invalid state'; end if;
 insert into public.asf_reviews(report_id,state,note,updated_by,updated_at)
 values(report,new_state,left(coalesce(new_note,''),4000),auth.uid(),now())
 on conflict(report_id) do update set state=excluded.state,note=excluded.note,
  updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 insert into public.asf_review_history(report_id,state,note,reviewed_by)
 values(report,new_state,left(coalesce(new_note,''),4000),auth.uid());
 insert into public.asf_audit(actor_id,action,target_id)
 values(auth.uid(),'review',report::text);
end $fn$;
revoke all on function public.asf_review_report(uuid,text,text) from public,anon;
grant execute on function public.asf_review_report(uuid,text,text) to authenticated;
