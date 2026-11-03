-- 20: Mandatory explanation for approving new ASF portal accounts.
-- Legacy approved accounts are not changed. Pending users can add a missing reason.
alter table public.asf_profiles
 add column if not exists activation_reason text not null default '';
alter table public.asf_profiles
 drop constraint if exists asf_activation_reason_max_length;
alter table public.asf_profiles
 add constraint asf_activation_reason_max_length
 check (char_length(activation_reason) <= 500);

-- Metadata is used only as the initial user-provided description, never as
-- an authorization claim. Server-side approval checks the stored profile field.
create or replace function public.asf_create_profile()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_reason text;
begin
 if new.raw_user_meta_data->>'asf_portal'='true' then
  v_reason:=btrim(coalesce(new.raw_user_meta_data->>'activation_reason',''));
  if char_length(v_reason) < 10 or char_length(v_reason)>500 then v_reason:=''; end if;
  insert into public.asf_profiles(user_id,game_name,discord_id,rank,activation_reason)
  values(new.id,
    btrim(coalesce(new.raw_user_meta_data->>'game_name','')),
    coalesce(new.raw_user_meta_data->>'discord_id',''),
    coalesce(new.raw_user_meta_data->>'rank',''),
    v_reason);
 end if;
 return new;
end;
$$;
revoke all on function public.asf_create_profile() from public,anon,authenticated;

-- A trigger guards *every* way to change a pending/rejected/suspended
-- account to approved, even if an older admin RPC omits the check.
create or replace function public.asf_require_activation_reason()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status='approved' and old.status is distinct from 'approved'
   and char_length(btrim(coalesce(new.activation_reason,''))) < 10 then
  raise exception 'Activation reason is required before approval';
 end if;
 return new;
end;
$$;
revoke all on function public.asf_require_activation_reason() from public,anon,authenticated;
drop trigger if exists asf_activation_reason_required on public.asf_profiles;
create trigger asf_activation_reason_required
 before update of status on public.asf_profiles
 for each row execute function public.asf_require_activation_reason();

-- Pending users can repair missing explanations without deleting/re-registering
-- their account. No user may edit someone else's reason or grant approval.
create or replace function public.asf_submit_activation_reason(p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_reason text:=btrim(coalesce(p_reason,''));
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if char_length(v_reason) < 10 or char_length(v_reason) > 500 then
  raise exception 'Reason must be between 10 and 500 characters';
 end if;
 update public.asf_profiles
 set activation_reason=v_reason,updated_at=now()
 where user_id=auth.uid() and status='pending';
 if not found then raise exception 'Only your own pending activation can be updated'; end if;
 insert into public.asf_audit(actor_id,action,target_id,detail)
 values(auth.uid(),'activation_reason_submitted',auth.uid()::text,
        jsonb_build_object('reason_length',char_length(v_reason)));
 insert into public.asf_notifications(recipient_id,category,message)
 select c.user_id,'registration','تم استكمال سبب طلب التفعيل لحساب بانتظار المراجعة.'
 from app_private.commanders c;
end;
$$;
revoke all on function public.asf_submit_activation_reason(text) from public,anon,authenticated;
grant execute on function public.asf_submit_activation_reason(text) to authenticated;
