-- Run AFTER schema.sql. Adds an authoritative submission receipt for confidential reports.
-- Secret report is NEVER readable by sender after submission.
create or replace function public.asf_submit_report(
 p_kind text,p_mode text,p_title text,p_body jsonb,p_original_report_id uuid,p_pdf_path text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare p public.asf_profiles%rowtype; r public.asf_reports%rowtype;
begin
 if auth.uid() is null or not public.asf_approved() then raise exception 'Account not approved'; end if;
 if p_kind not in ('personnel','officers','joint','presidencies','secret')
 or p_mode not in ('structured','free')
 or length(trim(coalesce(p_title,''))) not between 3 and 180
 or p_body is null or jsonb_typeof(p_body)<>'object'
 or length(p_body::text)>40000 then raise exception 'Invalid report'; end if;
 if p_pdf_path !~ ('^'||auth.uid()::text||'/[a-f0-9-]{36}\\.pdf$') then raise exception 'Invalid PDF path'; end if;
 if p_original_report_id is not null and not exists(
 select 1 from public.asf_reports where id=p_original_report_id and author_id=auth.uid() and kind=p_kind
 ) then raise exception 'Correction must reference your own original report'; end if;
 select * into p from public.asf_profiles where user_id=auth.uid();
 insert into public.asf_reports(author_id,kind,mode,title,body,sender_name,sender_rank,sender_code,original_report_id,pdf_path)
 values(auth.uid(),p_kind,p_mode,trim(p_title),p_body,p.game_name,p.rank,p.military_code,p_original_report_id,p_pdf_path)
 returning * into r;
 return jsonb_build_object('id',r.id,'report_number',r.report_number,'submitted_at',r.submitted_at);
end; $$;
revoke all on function public.asf_submit_report(text,text,text,jsonb,uuid,text) from public;
grant execute on function public.asf_submit_report(text,text,text,jsonb,uuid,text) to authenticated;
-- Do not allow circumventing validated RPC with arbitrary direct inserts
revoke insert on public.asf_reports from authenticated;
drop policy if exists "reports restricted read" on public.asf_reports;
create policy "reports restricted read" on public.asf_reports for select to authenticated using(
 (kind='secret' and public.asf_is_commander())
 or (kind<>'secret' and (public.asf_is_commander() or
 (deleted_at is null and (author_id=auth.uid() or public.asf_can_read_kind(kind)))))
);
-- Delete from trash after 30 days needs a server job using service key and Storage API.
-- Never expose service_role key in frontend config.
