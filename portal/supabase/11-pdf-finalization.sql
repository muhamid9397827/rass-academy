-- Track PDF persistence separately from the immutable report body.
alter table public.asf_reports add column if not exists pdf_ready_at timestamptz;
update public.asf_reports r set pdf_ready_at=coalesce(pdf_ready_at,submitted_at)
where r.pdf_ready_at is null and exists(select 1 from storage.objects o
where o.bucket_id='asf-reports' and o.name=r.pdf_path);

create or replace function public.asf_mark_pdf_ready(p_report uuid)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare r public.asf_reports%rowtype;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 select * into r from public.asf_reports where id=p_report for update;
 if not found then raise exception 'Report not found'; end if;
 if not public.asf_is_commander() and (r.author_id<>auth.uid() or not public.asf_approved())
 then raise exception 'Not authorized'; end if;
 if r.deleted_at is not null then raise exception 'Report in trash'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='asf-reports' and o.name=r.pdf_path)
 then return false; end if;
 if r.pdf_ready_at is null then
  update public.asf_reports set pdf_ready_at=now() where id=r.id;
  insert into public.asf_audit(actor_id,action,target_id)
   values(auth.uid(),'pdf_finalized',r.id::text);
 end if;
 return true;
end $fn$;
revoke all on function public.asf_mark_pdf_ready(uuid) from public,anon;
grant execute on function public.asf_mark_pdf_ready(uuid) to authenticated;
