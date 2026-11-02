
-- بوابة أمن المنشآت: سجل إنذارات قضائي جديد، منفصل عن الأرشيف القديم
create table if not exists public.asf_court_warnings(
 id uuid primary key default gen_random_uuid(),
 case_id uuid references public.asf_court_cases(id) on delete set null,
 player_name text not null check(length(trim(player_name)) between 2 and 120),
 player_rank text not null check(length(trim(player_rank)) between 2 and 60),
 player_code text not null default '',
 offense text not null check(length(trim(offense))>3),
 punishment text not null check(length(trim(punishment))>2),
 warning_level text not null default 'شفهي',
 duration_days integer check(duration_days between 0 and 3650),
 recorded_by uuid not null default auth.uid() references auth.users(id),
 recorded_at timestamptz not null default now(),
 cancelled_at timestamptz,
 cancelled_by uuid references auth.users(id),
 cancellation_reason text
);
alter table public.asf_court_warnings enable row level security;
create policy "court members read warnings" on public.asf_court_warnings
for select to authenticated using (public.asf_has_court());
create policy "court members add warnings" on public.asf_court_warnings
for insert to authenticated with check(public.asf_has_court() and recorded_by=auth.uid() and cancelled_at is null);
revoke all on public.asf_court_warnings from anon,authenticated;
grant select,insert on public.asf_court_warnings to authenticated;

create or replace function public.asf_cancel_warning(p_warning uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $fn$
begin
 if auth.uid() is null or not public.asf_has_court() then raise exception 'Judicial access required'; end if;
 if length(trim(coalesce(p_reason,'')))<4 then raise exception 'Cancellation reason required'; end if;
 update public.asf_court_warnings set cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=left(p_reason,4000)
 where id=p_warning and cancelled_at is null;
 if not found then raise exception 'Warning not found or already cancelled'; end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'court_warning_cancel',p_warning::text,jsonb_build_object('reason',left(p_reason,4000)));
end $fn$;
revoke all on function public.asf_cancel_warning(uuid,text) from public,anon;
grant execute on function public.asf_cancel_warning(uuid,text) to authenticated;
