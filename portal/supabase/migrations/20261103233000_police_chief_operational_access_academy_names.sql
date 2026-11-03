-- Finish police chief operational permissions and reject single-word academy names on new receipts.
drop policy if exists "police chiefs read rule overrides" on public.asf_police_overrides;
create policy "police chiefs read rule overrides" on public.asf_police_overrides
 for select to authenticated
 using((select public.asf_is_police_head()));

create or replace function public.asf_set_police_override(p_key text,p_rank text,p_penalty text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or (not public.asf_is_commander()
   and not public.asf_has_feature('police.manage')
   and not public.asf_is_police_head())
 then raise exception 'Not authorized'; end if;
 if p_key !~ '^[a-zA-Z0-9-]{2,100}$'
   or length(trim(coalesce(p_rank,''))) not between 2 and 80
 then raise exception 'Invalid rule'; end if;
 if nullif(trim(coalesce(p_penalty,'')),'') is null then
  delete from public.asf_police_overrides where rule_key=p_key and rank_key=p_rank;
 else
  if length(trim(p_penalty)) not between 3 and 500 then raise exception 'Invalid penalty'; end if;
  insert into public.asf_police_overrides(rule_key,rank_key,penalty,updated_by,updated_at)
  values(p_key,p_rank,trim(p_penalty),auth.uid(),now())
  on conflict(rule_key,rank_key) do update
  set penalty=excluded.penalty,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'police_rule_override',p_key,
  jsonb_build_object('rank',p_rank,'removed',trim(coalesce(p_penalty,''))=''));
end;
$$;
revoke all on function public.asf_set_police_override(text,text,text) from public,anon,authenticated;
grant execute on function public.asf_set_police_override(text,text,text) to authenticated;

drop policy if exists "court cases create" on public.asf_court_cases;
create policy "court cases create" on public.asf_court_cases for insert to authenticated
 with check(submitted_by=(select auth.uid()) and
 ((select public.asf_is_commander()) or (select public.asf_has_feature('police.manage'))
  or (select public.asf_is_police_head())));
drop policy if exists "court cases read" on public.asf_court_cases;
create policy "court cases read" on public.asf_court_cases for select to authenticated
 using((select public.asf_has_court()) or
 (submitted_by=(select auth.uid()) and
 ((select public.asf_has_feature('police.manage')) or (select public.asf_is_police_head()))));

create or replace function public.asf_guard_academy_name()
returns trigger language plpgsql set search_path=''
as $$
begin
 if not public.asf_valid_full_name(new.trainee_name) then
  raise exception 'Full trainee first and family name required'; end if;
 return new;
end;
$$;
drop trigger if exists asf_guard_academy_name on public.asf_academy_results;
create trigger asf_guard_academy_name
 before insert or update of trainee_name on public.asf_academy_results
 for each row execute function public.asf_guard_academy_name();
