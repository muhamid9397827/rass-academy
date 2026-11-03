-- Durable public-academy receipts. Grades are calculated by the Edge Function,
-- never accepted from the browser. Public identity is declared, not verified.
create sequence public.asf_academy_receipt_seq;
create table public.asf_academy_results (
 id uuid primary key default gen_random_uuid(),
 receipt text not null unique default ('ACD-' || lpad(nextval('public.asf_academy_receipt_seq')::text,8,'0')),
 session_id text not null unique check(length(session_id) between 16 and 100),
 payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 client_hash text not null check(client_hash ~ '^[a-f0-9]{64}$'),
 course_id text not null,
 course_title text not null,
 trainee_name text not null check(length(trainee_name) between 3 and 60),
 trainee_rank text not null,
 discord_id text not null check(discord_id ~ '^[0-9]{15,20}$'),
 assigned_rank text not null default '',
 score integer not null,
 total integer not null check(total between 1 and 20),
 percentage integer not null check(percentage between 0 and 100),
 passed boolean not null,
 answers jsonb not null check(jsonb_typeof(answers)='array'),
 visibility_count integer not null default 0 check(visibility_count>=0),
 identity_verified boolean not null default false check(identity_verified=false),
 received_at timestamptz not null default now(),
 legacy_status text not null default 'pending' check(legacy_status in ('pending','confirmed','unconfirmed','failed')),
 legacy_updated_at timestamptz,
 check(score between 0 and total)
);
create index asf_academy_identity_time on public.asf_academy_results(discord_id,course_id,received_at desc);
create index asf_academy_client_time on public.asf_academy_results(client_hash,received_at desc);
alter table public.asf_academy_results enable row level security;
revoke all on public.asf_academy_results from public,anon,authenticated;
revoke all on sequence public.asf_academy_receipt_seq from public,anon,authenticated;
grant select on public.asf_academy_results to authenticated;
create policy "commander reads academy results" on public.asf_academy_results
 for select to authenticated using(public.asf_is_commander());

create or replace function public.asf_store_academy_result(p_result jsonb,p_payload_hash text,p_client_hash text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare saved public.asf_academy_results; was_inserted boolean:=false;
begin
 -- Only service_role is granted EXECUTE; all client roles are revoked below.
 perform pg_advisory_xact_lock(hashtextextended('asf-academy-ip:'||p_client_hash,0));
 perform pg_advisory_xact_lock(hashtextextended('asf-academy-session:'||(p_result->>'sessionId'),0));
 select * into saved from public.asf_academy_results where session_id=p_result->>'sessionId';
 if found then
  if saved.payload_hash<>p_payload_hash then raise exception 'session_conflict'; end if;
 else
  perform pg_advisory_xact_lock(hashtextextended('asf-academy-person:'||(p_result->>'discord')||':'||(p_result->>'courseId'),0));
  if exists(select 1 from public.asf_academy_results where discord_id=p_result->>'discord'
    and course_id=p_result->>'courseId' and received_at>now()-interval '24 hours') then
   raise exception 'retake_wait';
  end if;
  if (select count(*) from public.asf_academy_results where client_hash=p_client_hash and received_at>now()-interval '1 hour')>=20 then
   raise exception 'rate_limit';
  end if;
  insert into public.asf_academy_results(session_id,payload_hash,client_hash,course_id,course_title,trainee_name,trainee_rank,
   discord_id,assigned_rank,score,total,percentage,passed,answers,visibility_count)
  values(p_result->>'sessionId',p_payload_hash,p_client_hash,p_result->>'courseId',p_result->>'courseTitle',p_result->>'name',p_result->>'rank',
   p_result->>'discord',p_result->>'assignedRank',(p_result->>'score')::integer,(p_result->>'total')::integer,
   (p_result->>'percentage')::integer,(p_result->>'passed')::boolean,p_result->'answers',(p_result->>'visibilityCount')::integer)
  returning * into saved;
  was_inserted:=true;
 end if;
 return jsonb_build_object('receipt',saved.receipt,'received_at',saved.received_at,'legacy_status',saved.legacy_status,'inserted',was_inserted);
end $fn$;
revoke all on function public.asf_store_academy_result(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.asf_store_academy_result(jsonb,text,text) to service_role;

create or replace function public.asf_mark_academy_legacy_sync(p_session text,p_status text)
returns void language sql security definer set search_path=''
as $fn$
 update public.asf_academy_results set legacy_status=p_status,legacy_updated_at=now() where session_id=p_session;
$fn$;
revoke all on function public.asf_mark_academy_legacy_sync(text,text) from public,anon,authenticated;
grant execute on function public.asf_mark_academy_legacy_sync(text,text) to service_role;
