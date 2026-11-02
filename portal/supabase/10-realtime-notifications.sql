-- Postgres Changes streams only rows allowed by the per-recipient RLS SELECT policy.
alter publication supabase_realtime add table public.asf_notifications;
