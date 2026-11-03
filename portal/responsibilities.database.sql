-- Run inside BEGIN/ROLLBACK. No persistent users, reports, emails or permissions.
begin;
do $qa$
declare leader uuid; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); applicant uuid:=gen_random_uuid();
 secret_id uuid; normal_id uuid; secret_path text; result_id uuid; saved jsonb; grade jsonb; answer jsonb; blocked boolean;
begin
 select user_id into leader from app_private.commanders limit 1;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (a,'qa-'||a||'@example.invalid',now(),'{}'),(b,'qa-'||b||'@example.invalid',now(),'{}'),(applicant,'qa-'||applicant||'@example.invalid',now(),'{}');
 insert into public.asf_profiles(user_id,game_name,discord_id,rank,status,military_code,activation_reason) values
 (a,'مسؤول تجريبي','999000000000000010','جندي','approved','QA-'||a,'اختبار مؤقت للصلاحيات'),
 (b,'عضو تجريبي','999000000000000011','جندي','approved','QA-'||b,'اختبار مؤقت للصلاحيات'),
 (applicant,'طلب عضوية تجريبي','999000000000000012','جندي','pending',null,'اختبار مؤقت لقبول العضوية');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',leader,'role','authenticated')::text,true);
 perform public.asf_set_delegations(array[a],array['users.approve'],null,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','user_metadata',jsonb_build_object('commander',true))::text,true);
 execute 'set local role authenticated';
 if not exists(select 1 from public.asf_profiles where user_id=applicant) then raise exception 'Admissions cannot read pending request';end if;
 if exists(select 1 from public.asf_profiles where user_id=b) then raise exception 'Admissions sees unrelated approved profiles';end if;
 perform public.asf_admin_action('approve',applicant,null);
 if exists(select 1 from public.asf_profiles where user_id=applicant) then raise exception 'Admissions retains broad member visibility';end if;
 blocked:=false;begin perform public.asf_admin_action('approve',a,null);exception when others then blocked:=true;end;if not blocked then raise exception 'Self-approval allowed';end if;
 blocked:=false;begin perform public.asf_admin_action('rank',b,'لواء');exception when others then blocked:=true;end;if not blocked then raise exception 'Delegated rank escalation';end if;
 blocked:=false;begin perform public.asf_admin_action('suspend',b,null);exception when others then blocked:=true;end;if not blocked then raise exception 'Delegated suspension allowed';end if;
 blocked:=false;begin perform public.asf_set_delegation(b,'court.manage',null,true);exception when others then blocked:=true;end;if not blocked then raise exception 'Delegate grants access';end if;
 blocked:=false;begin insert into public.asf_responsibilities(user_id,permission)values(a,'academy.manage');exception when others then blocked:=true;end;if not blocked then raise exception 'Direct grant insert allowed';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 secret_path:=b::text||'/'||gen_random_uuid()::text||'.pdf';
 saved:=public.asf_submit_report('secret','free','اختبار سري','{"text":"محتوى سري اصطناعي"}',null,secret_path);secret_id:=(saved->>'id')::uuid;
 saved:=public.asf_submit_report('personnel','free','اختبار عادي','{"text":"محتوى اصطناعي"}',null,b::text||'/'||gen_random_uuid()::text||'.pdf');normal_id:=(saved->>'id')::uuid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',leader,'role','authenticated')::text,true);
 perform public.asf_review_report(secret_id,'reviewed','ملاحظة سرية اصطناعية');
 perform public.asf_set_delegations(array[a],array['reports.read','reports.review','police.manage','court.manage','users.review','academy.manage'],null,true);
 blocked:=false;begin perform public.asf_set_delegation(a,'reports.read','secret',true);exception when others then blocked:=true;end;if not blocked then raise exception 'Secret type delegated';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','user_metadata',jsonb_build_object('role','commander'))::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.asf_reports where id=secret_id) then raise exception 'All-permission delegate reads secret';end if;
 if not exists(select 1 from public.asf_reports where id=normal_id) then raise exception 'Normal report delegation failed';end if;
 if public.asf_pdf_can_read(secret_path) then raise exception 'Secret PDF leaked';end if;
 if exists(select 1 from public.asf_reviews where report_id=secret_id) or exists(select 1 from public.asf_review_history where report_id=secret_id) then raise exception 'Secret review leaked';end if;
 if exists(select 1 from public.asf_notifications where category='secret_report') then raise exception 'Secret notice leaked';end if;
 blocked:=false;begin perform public.asf_review_report(secret_id,'reviewed','اختراق');exception when others then blocked:=true;end;if not blocked then raise exception 'Delegate reviews secret';end if;
 execute 'reset role';
 grade:=jsonb_build_object('sessionId','SESSION-'||gen_random_uuid(),'courseId','operations','courseTitle','دورة العمليات','name','ناجح تجريبي','rank','جندي','discord','999000000000000099','assignedRank','','score',10,'total',10,'percentage',100,'passed',true,'answers','[]'::jsonb,'visibilityCount',0);
 saved:=public.asf_store_academy_result(grade,repeat('a',64),repeat('b',64));
 select id into result_id from public.asf_academy_results where receipt=saved->>'receipt';
 if not exists(select 1 from public.asf_notifications where recipient_id=a and event_kind='academy_pass') then raise exception 'Course leader not notified';end if;
 if exists(select 1 from public.asf_notifications where recipient_id=b and event_kind='academy_pass') then raise exception 'Unrelated member notified';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.asf_academy_results where id=result_id) then raise exception 'Ordinary member reads course ledger';end if;
 blocked:=false;begin perform public.asf_confirm_academy_delivery(result_id);exception when others then blocked:=true;end;if not blocked then raise exception 'Ordinary member confirms delivery';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 blocked:=false;begin update public.asf_academy_results set delivered_by_name='اسم مزور' where id=result_id;exception when others then blocked:=true;end;if not blocked then raise exception 'Raw delivery update permitted';end if;
 answer:=public.asf_confirm_academy_delivery(result_id);
 if answer->>'delivered_by_name'<>'مسؤول تجريبي' or (answer->>'already_delivered')::boolean then raise exception 'Wrong server identity';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',leader,'role','authenticated')::text,true);
 answer:=public.asf_confirm_academy_delivery(result_id);
 if answer->>'delivered_by_name'<>'مسؤول تجريبي' or not (answer->>'already_delivered')::boolean then raise exception 'Second reviewer overwrote first';end if;
 perform public.asf_set_delegation(a,'academy.manage',null,false);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.asf_academy_results where id=result_id) then raise exception 'Revoked course leader retains access';end if;
 blocked:=false;begin perform public.asf_confirm_academy_delivery(result_id);exception when others then blocked:=true;end;if not blocked then raise exception 'Revoked course leader confirms delivery';end if;
 execute 'reset role';
 if has_function_privilege('authenticated','public.asf_course_email_claim_due(integer)','execute') then raise exception 'Course mail data exposed';end if;
 if has_table_privilege('anon','public.asf_academy_results','select') then raise exception 'Public course ledger';end if;
 if (select public from storage.buckets where id='asf-reports') then raise exception 'Report bucket is public';end if;
end $qa$;
select 'PASS: scoped admissions, seven independent permissions, secret reports/PDF/reviews/notifications denied, passed-course notices, immutable delivery identity, idempotence and immediate revocation' as verification;
rollback;
