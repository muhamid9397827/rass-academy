-- Access hardening and delegated review on non-secret report categories.
-- Commander is a singleton; no delegate can ever read the "secret" category.
create unique index if not exists asf_one_commander_only on app_private.commanders ((true));

alter table public.asf_delegations drop constraint if exists asf_delegations_permission_check;
alter table public.asf_delegations add constraint asf_delegations_permission_check
check(permission in ('reports.read','reports.review','police.manage','court.manage','users.review'));

create unique index if not exists asf_delegate_kind_unique
on public.asf_delegations(user_id,permission,coalesce(report_kind,''));

create or replace function public.asf_can_review_kind(k text)
returns boolean language sql stable security definer set search_path=''
as $func$
 select k <> 'secret' and auth.uid() is not null and public.asf_approved()
  and exists(select 1 from public.asf_delegations d where d.user_id=auth.uid()
    and d.permission='reports.review' and (d.report_kind=k or d.report_kind is null));
$func$;
revoke all on function public.asf_can_review_kind(text) from public,anon;
grant execute on function public.asf_can_review_kind(text) to authenticated;

create or replace function public.asf_set_delegation(target uuid, feature text, kind text, enabled boolean)
returns void language plpgsql security definer set search_path=''
as $func$
begin
 if auth.uid() is null or not public.asf_is_commander() then raise exception 'Not authorized'; end if;
 if feature not in ('reports.read','reports.review','police.manage','court.manage','users.review')
    or (kind is not null and (feature not in ('reports.read','reports.review')
       or kind not in ('personnel','officers','joint','presidencies')))
 then raise exception 'Invalid delegation'; end if;
 if not exists(select 1 from public.asf_profiles where user_id=target and status='approved')
 then raise exception 'Target must be an approved member'; end if;
 if enabled then
  insert into public.asf_delegations(user_id,permission,report_kind) values(target,feature,kind)
   on conflict do nothing;
 else
  delete from public.asf_delegations where user_id=target and permission=feature
   and report_kind is not distinct from kind;
 end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'delegation',target::text,
  jsonb_build_object('feature',feature,'kind',kind,'enabled',enabled));
end $func$;
revoke all on function public.asf_set_delegation(uuid,text,text,boolean) from public,anon;
grant execute on function public.asf_set_delegation(uuid,text,text,boolean) to authenticated;

drop policy if exists "reports restricted read" on public.asf_reports;
create policy "reports restricted read" on public.asf_reports
 for select to authenticated using(
   (kind='secret' and public.asf_is_commander())
   or (kind<>'secret' and
     (public.asf_is_commander()
     or (deleted_at is null and public.asf_approved()
         and (author_id=auth.uid() or public.asf_can_read_kind(kind)
              or public.asf_can_review_kind(kind)))))
 );

create or replace function public.asf_pdf_can_read(path text)
returns boolean language sql stable security definer set search_path=''
as $func$
 select auth.uid() is not null and exists(select 1 from public.asf_reports r
 where r.pdf_path=path and r.deleted_at is null
   and ((r.kind='secret' and public.asf_is_commander())
   or (r.kind<>'secret' and (public.asf_is_commander()
     or (public.asf_approved() and (r.author_id=auth.uid()
       or public.asf_can_read_kind(r.kind) or public.asf_can_review_kind(r.kind)))))));
$func$;
revoke all on function public.asf_pdf_can_read(text) from public,anon;
grant execute on function public.asf_pdf_can_read(text) to authenticated;

create or replace function public.asf_review_report(report uuid,new_state text,new_note text)
returns void language plpgsql security definer set search_path=''
as $func$
declare r_kind text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select kind into r_kind from public.asf_reports where id=report and deleted_at is null;
 if not found then raise exception 'Report unavailable'; end if;
 if not public.asf_is_commander() and not public.asf_can_review_kind(r_kind)
 then raise exception 'Not authorized'; end if;
 if new_state not in ('new','reviewing','reviewed','needs_more') then raise exception 'Invalid state'; end if;
 insert into public.asf_reviews(report_id,state,note,updated_by,updated_at)
 values(report,new_state,left(coalesce(new_note,''),4000),auth.uid(),now())
 on conflict(report_id) do update set state=excluded.state,note=excluded.note,
 updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 insert into public.asf_audit(actor_id,action,target_id)
 values(auth.uid(),'review',report::text);
end $func$;
revoke all on function public.asf_review_report(uuid,text,text) from public,anon;
grant execute on function public.asf_review_report(uuid,text,text) to authenticated;

-- Allow commander to upload a missing PDF to the originally registered private path,
-- including the author's folder, but never overwrite an existing file (no update policy).
drop policy if exists "asf pdf upload own folder" on storage.objects;
create policy "asf pdf upload own folder" on storage.objects for insert to authenticated
with check(bucket_id='asf-reports' and lower(storage.extension(name))='pdf' and
  ((public.asf_approved() and (storage.foldername(name))[1]=auth.uid()::text)
    or (public.asf_is_commander() and exists(
       select 1 from public.asf_reports r where r.pdf_path=name and r.deleted_at is null))
  ));
