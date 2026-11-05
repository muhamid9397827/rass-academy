-- These orchestration helpers access no tables directly. Keep privileged work
-- in their existing role-checked callees, using the caller's rights here.
alter function public.asf_can_manage_members() security invoker;
alter function public.asf_department_can_manage(text) security invoker;
alter function public.asf_department_set_role(uuid,text,text,boolean) security invoker;
alter function public.asf_police_set_role(uuid,text,boolean) security invoker;
alter function public.asf_recruitment_accept(uuid) security invoker;
