
create table if not exists public.asf_notifications(
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in('registration','report','secret_report','account_change')),
 message text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz
);
alter table public.asf_notifications enable row level security;
create policy "recipient may read notices" on public.asf_notifications for select to authenticated using(recipient_id=auth.uid());
create policy "recipient may mark notices" on public.asf_notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
revoke all on public.asf_notifications from anon,authenticated;
grant select,update(read_at) on public.asf_notifications to authenticated;
create or replace function public.asf_queue_notice() returns trigger
language plpgsql security definer set search_path=''
as $fn$
declare msg text; cat text;
begin
 if TG_TABLE_NAME='asf_profiles' then cat:='registration';msg:='طلب تسجيل حساب جديد بانتظار تفعيل القائد';
 elsif TG_TABLE_NAME='asf_reports' then
  if NEW.kind='secret' then cat:='secret_report';msg:='ورد تقرير سري للغاية إلى القائد';
  else cat:='report';msg:='ورد تقرير إداري جديد للمراجعة'; end if;
 elsif TG_TABLE_NAME='asf_change_requests' then
  cat:='account_change';msg:='ورد طلب تعديل بيانات مستخدم';
 else return NEW;
 end if;
 insert into public.asf_notifications(recipient_id,category,message)
 select user_id,cat,msg from app_private.commanders;
 return NEW;
end $fn$;
revoke all on function public.asf_queue_notice() from public,anon,authenticated;
drop trigger if exists asf_notice_registration on public.asf_profiles;
create trigger asf_notice_registration after insert on public.asf_profiles for each row execute function public.asf_queue_notice();
drop trigger if exists asf_notice_report on public.asf_reports;
create trigger asf_notice_report after insert on public.asf_reports for each row execute function public.asf_queue_notice();
drop trigger if exists asf_notice_change on public.asf_change_requests;
create trigger asf_notice_change after insert on public.asf_change_requests for each row execute function public.asf_queue_notice();
