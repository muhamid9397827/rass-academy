-- 18: Commander-reviewed permission requests. No permissions are granted by INSERT.
-- Ordinary users can only read their own requests. Secret reports are NEVER delegable.
create table if not exists public.asf_access_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references public.asf_profiles(user_id) on delete cascade,
 permission text not null check (permission in ('court.manage','police.manage','reports.read','reports.review','users.review')),
 reason text not null check (char_length(btrim(reason)) between 8 and 400),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 decision_note text not null default '' check (char_length(decision_note) <= 400),
 constraint asf_access_requests_review_consistency check (
  (status='pending' and reviewed_at is null and reviewed_by is null)
  or (status in ('approved','rejected') and reviewed_at is not null and reviewed_by is not null)
 )
);
create unique index if not exists asf_access_requests_one_pending
 on public.asf_access_requests(user_id,permission) where status='pending';
create index if not exists asf_access_requests_commander_queue
 on public.asf_access_requests(status,created_at desc);

alter table public.asf_access_requests enable row level security;
revoke all on public.asf_access_requests from public, anon, authenticated;
grant select on public.asf_access_requests to authenticated;

drop policy if exists "access requests requester or commander" on public.asf_access_requests;
create policy "access requests requester or commander"
 on public.asf_access_requests for select to authenticated
 using (user_id=(select auth.uid()) or (select public.asf_is_commander()));

-- Only this function can create a request. The server fixes user_id and status;
-- direct INSERT and UPDATE are prohibited to authenticated users.
create or replace function public.asf_request_access(p_permission text,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid := auth.uid(); v_id uuid; v_reason text := btrim(coalesce(p_reason,''));
begin
 if v_user is null or not public.asf_approved() or public.asf_is_commander() then
  raise exception 'Only approved members can request access';
 end if;
 if p_permission is null or p_permission not in
  ('court.manage','police.manage','reports.read','reports.review','users.review')
 then raise exception 'Invalid permission requested'; end if;
 if char_length(v_reason) < 8 or char_length(v_reason) > 400
 then raise exception 'Reason must be 8 to 400 characters'; end if;
 if exists(select 1 from public.asf_delegations d
   where d.user_id=v_user and d.permission=p_permission and d.report_kind is null)
   or (p_permission='court.manage' and exists(
     select 1 from public.asf_profiles p where p.user_id=v_user and p.court_enabled))
 then raise exception 'You already have this permission'; end if;
 if exists(select 1 from public.asf_access_requests r
  where r.user_id=v_user and r.permission=p_permission and r.status='pending')
 then raise exception 'A request for this permission is already pending'; end if;
 if (select count(*) from public.asf_access_requests r
      where r.user_id=v_user and r.created_at > now()-interval '24 hours') >= 3
 then raise exception 'You have reached the daily request limit'; end if;

 insert into public.asf_access_requests(user_id,permission,reason)
 values(v_user,p_permission,v_reason) returning id into v_id;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(v_user,'access_requested',v_id::text,jsonb_build_object('permission',p_permission));
 insert into public.asf_notifications(recipient_id,category,message)
 select c.user_id,'access_request',
   'طلب تصريح جديد: '||coalesce(p.game_name,'عضو')||' — '||p_permission
 from app_private.commanders c
 join public.asf_profiles p on p.user_id=v_user;
 return v_id;
end;
$$;
revoke all on function public.asf_request_access(text,text) from public,anon,authenticated;
grant execute on function public.asf_request_access(text,text) to authenticated;

-- Atomic decision: only the actual commander can approve. Reuse existing server-side
-- delegation RPC so audit, permitted feature list and target checks stay authoritative.
create or replace function public.asf_review_access_request(
 p_request uuid,p_allow boolean,p_note text default ''
) returns void language plpgsql security definer set search_path=''
as $$
declare v_request public.asf_access_requests%rowtype; v_note text := btrim(coalesce(p_note,''));
begin
 if auth.uid() is null or not public.asf_is_commander()
 then raise exception 'Commander only'; end if;
 if p_request is null or p_allow is null
 then raise exception 'Invalid decision'; end if;
 if char_length(v_note)>400 then raise exception 'Decision note too long'; end if;
 select * into v_request from public.asf_access_requests
 where id=p_request for update;
 if not found then raise exception 'Request not found'; end if;
 if v_request.status<>'pending' then raise exception 'Request already reviewed'; end if;
 if p_allow then
  perform public.asf_set_delegation(v_request.user_id,v_request.permission,null,true);
 end if;
 update public.asf_access_requests
 set status=case when p_allow then 'approved' else 'rejected' end,
  reviewed_by=auth.uid(), reviewed_at=now(), decision_note=v_note
 where id=p_request;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'access_reviewed',p_request::text,
   jsonb_build_object('permission',v_request.permission,'approved',p_allow,'user_id',v_request.user_id));
 insert into public.asf_notifications(recipient_id,category,message)
 values(v_request.user_id,'access_decision',
  case when p_allow then 'تمت الموافقة على طلب التصريح: ' else 'تم رفض طلب التصريح: ' end
  ||v_request.permission);
end;
$$;
revoke all on function public.asf_review_access_request(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.asf_review_access_request(uuid,boolean,text) to authenticated;
