-- 19: Extend existing ASF notice types without changing notification read RLS.
-- New events are still readable only by their recipient.
alter table public.asf_notifications
 drop constraint if exists asf_notifications_category_check;
alter table public.asf_notifications
 add constraint asf_notifications_category_check
 check(category in (
  'registration','report','secret_report','account_change',
  'access_request','access_decision'
 ));
