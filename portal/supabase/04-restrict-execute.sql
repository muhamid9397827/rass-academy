-- Supabase's public-schema defaults explicitly grant EXECUTE to anon.
-- Revoke for ASF functions only. Keep unrelated project functions untouched.
do $grant$
declare f record;
begin
 for f in
  select p.oid::regprocedure as ident,p.proname
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'asf_%'
 loop
  execute format('revoke all on function %s from public, anon',f.ident);
  if f.proname='asf_create_profile' then
   execute format('revoke all on function %s from authenticated',f.ident);
  else
   execute format('grant execute on function %s to authenticated',f.ident);
  end if;
 end loop;
end $grant$;
revoke all on sequence public.asf_military_seq from anon, authenticated;
-- Unprivileged app accounts must not insert/alter auditing or approvals.
