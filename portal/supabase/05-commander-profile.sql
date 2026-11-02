
-- A previously verified auth user may be identified as commander.
-- This RPC lets that commander create the required ASF profile ONCE, with real details.
create or replace function public.asf_commander_profile_setup(p_name text,p_discord text,p_rank text)
returns text language plpgsql security definer set search_path=''
as $fn$
declare vcode text;
begin
 if auth.uid() is null or not public.asf_is_commander() then raise exception 'Commander only'; end if;
 if exists(select 1 from public.asf_profiles where user_id=auth.uid()) then raise exception 'Profile already exists'; end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 80
 or p_discord !~ '^[0-9]{17,20}$' then raise exception 'Invalid account data'; end if;
 -- Rank is also checked by the table constraint.
 vcode:='ASF-'||lpad(nextval('public.asf_military_seq'::regclass)::text,6,'0');
 insert into public.asf_profiles(user_id,game_name,discord_id,rank,military_code,status)
 values(auth.uid(),trim(p_name),p_discord,p_rank,vcode,'approved');
 insert into public.asf_audit(actor_id,action,target_id)
 values(auth.uid(),'commander_profile_init',auth.uid()::text);
 return vcode;
end $fn$;
revoke all on function public.asf_commander_profile_setup(text,text,text) from public,anon;
grant execute on function public.asf_commander_profile_setup(text,text,text) to authenticated;
