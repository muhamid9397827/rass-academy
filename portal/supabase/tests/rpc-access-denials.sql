-- Non-destructive regression audit: no persisted writes or production identities.
begin;
set local statement_timeout = '20s';
do $audit$
declare f record; claims text; call_sql text; result jsonb; succeeded boolean; checks integer:=0;
begin
 for claims in select c from (values
  ('{"role":"authenticated","aal":"aal1"}'),
  (jsonb_build_object('role','authenticated','aal','aal1','sub',gen_random_uuid()::text)::text)
 ) identities(c) loop
  perform set_config('request.jwt.claims',claims,true);
  execute 'set local role authenticated';
  for f in
   select p.oid,p.proname,p.prorettype,p.proargtypes,p.provolatile,
    (select string_agg('null::'||format_type(t,null),',' order by ord)
     from unnest(p.proargtypes::oid[]) with ordinality args(t,ord)) as null_args
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('asf_admin_action','asf_approved','asf_auth_ban_allowed','asf_can_manage_members','asf_can_read_kind','asf_can_review_kind','asf_cancel_warning','asf_commander_mfa_required','asf_commander_profile_setup','asf_confirm_academy_delivery','asf_create_operation_task','asf_department_can_manage','asf_department_candidates','asf_department_has_role','asf_department_mark_paid','asf_department_set_role','asf_has_court','asf_has_feature','asf_is_commander','asf_is_court_head','asf_is_police_head','asf_management_directory','asf_management_set_head','asf_management_set_staff','asf_mark_pdf_ready','asf_pdf_can_read','asf_police_directory','asf_police_set_head','asf_police_set_role','asf_recruitment_accept','asf_recruitment_qualification_action','asf_report_receipt','asf_request_access','asf_review_access_request','asf_review_change','asf_review_report','asf_service_reward_claim','asf_service_reward_mark_paid','asf_set_delegation','asf_set_delegations','asf_set_police_override','asf_submit_activation_reason','asf_submit_report','asf_training_review_result','asf_trash_report','asf_update_operation_task','current_user_role')
   order by p.proname
  loop
   call_sql:=format('select to_jsonb(public.%I(%s))',f.proname,coalesce(f.null_args,''));
   if f.prorettype='boolean'::regtype and f.provolatile<>'v' then
    execute call_sql into result;
    if result='true'::jsonb then raise exception 'Unexpected access: %',f.proname; end if;
   elsif f.proname='current_user_role' then
    execute call_sql into result;
    if result is not null and result<>'null'::jsonb then raise exception 'Unexpected legacy role'; end if;
   else
    succeeded:=false;
    begin
     execute call_sql into result;
     succeeded:=true;
    exception when sqlstate 'P0001' or insufficient_privilege then null;
    end;
    if succeeded then raise exception 'Unauthorized RPC accepted: %',f.proname; end if;
   end if;
   checks:=checks+1;
  end loop;
  execute 'reset role';
 end loop;
 if checks<>94 then raise exception 'Incomplete RPC audit: %',checks; end if;
end;
$audit$;
rollback;
select 'PASS: 94 unauthenticated/unapproved RPC checks; all writes rolled back' as result;
