-- Harden shared legacy helpers without changing authenticated role policies.
-- Both function bodies already qualify their application objects explicitly.
alter function public.touch_updated_at() set search_path = '';
alter function public.current_user_role() set search_path = '';

-- Anonymous callers have no user role; authenticated RLS policies still need this lookup.
revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated, service_role;
