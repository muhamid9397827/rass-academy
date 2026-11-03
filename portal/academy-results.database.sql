begin;

do $qa$
declare v jsonb; duplicate jsonb; grade jsonb; blocked boolean:=false;
begin
 grade:=jsonb_build_object('sessionId','SESSION-qa-receipt-20261103','courseId','operations','courseTitle','دورة العمليات','name','اختبار تقني','rank','جندي','discord','999000000000000001','assignedRank','','score',7,'total',10,'percentage',70,'passed',true,'answers','[]'::jsonb,'visibilityCount',0);
 v:=public.asf_store_academy_result(grade,repeat('a',64),repeat('b',64));
 duplicate:=public.asf_store_academy_result(grade,repeat('a',64),repeat('b',64));
 if v->>'receipt'<>duplicate->>'receipt' or (duplicate->>'inserted')::boolean then raise exception 'Idempotence failure'; end if;
 begin perform public.asf_store_academy_result(grade,repeat('c',64),repeat('b',64));
 exception when others then blocked:=sqlerrm='session_conflict'; end;
 if not blocked then raise exception 'Overwrite protection failure'; end if;
 blocked:=false;
 begin perform public.asf_store_academy_result(grade||'{"sessionId":"SESSION-qa-retake-20261103"}'::jsonb,repeat('c',64),repeat('b',64));
 exception when others then blocked:=sqlerrm='retake_wait'; end;
 if not blocked then raise exception 'Cooldown failure'; end if;
 if has_function_privilege('anon','public.asf_store_academy_result(jsonb,text,text)','execute') or has_function_privilege('authenticated','public.asf_store_academy_result(jsonb,text,text)','execute') then raise exception 'RPC exposed to clients'; end if;
 if has_table_privilege('anon','public.asf_academy_results','select') or has_table_privilege('authenticated','public.asf_academy_results','insert,update,delete') then raise exception 'Unsafe table grant'; end if;
 if not (select relrowsecurity from pg_class where oid='public.asf_academy_results'::regclass) then raise exception 'RLS is off'; end if;
end $qa$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
do $qa$ begin if exists(select 1 from public.asf_academy_results) then raise exception 'Member read other training results'; end if; end $qa$;
reset role;
select 'PASS: idempotency, overwrite denial, 24h cooldown, RPC grants and member RLS' as verification;

rollback;

