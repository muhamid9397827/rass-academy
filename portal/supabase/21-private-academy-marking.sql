-- Private schema only. DO NOT commit any answer-key data in a public repository.
create table if not exists app_private.asf_academy_grade_catalog (
 course_id text primary key,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 updated_at timestamptz not null default now()
);
alter table app_private.asf_academy_grade_catalog enable row level security;
revoke all on app_private.asf_academy_grade_catalog from public,anon,authenticated;
create or replace function public.asf_private_academy_catalog()
returns jsonb language sql stable security definer set search_path=''
as $$ select coalesce(jsonb_object_agg(course_id,payload),'{}'::jsonb)
from app_private.asf_academy_grade_catalog; $$;
revoke all on function public.asf_private_academy_catalog() from public,anon,authenticated;
grant execute on function public.asf_private_academy_catalog() to service_role;
-- Provision keys through a trusted, private database procedure, never this SQL file.
