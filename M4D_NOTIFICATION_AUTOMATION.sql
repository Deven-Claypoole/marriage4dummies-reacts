-- M4D ONE SIGNAL AUTOMATIONS. Execute ONCE in the existing Supabase SQL Editor.
-- Builds upon the m4d_push_events and m4d_notification_preferences tables
-- installed with M4D_FEATURES_SETUP.sql.

alter table public.m4d_push_events
  add column if not exists source_key text,
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists processed_at timestamptz;
create unique index if not exists m4d_push_events_source_key_idx
  on public.m4d_push_events(source_key) where source_key is not null;
create index if not exists m4d_push_events_queue_idx
  on public.m4d_push_events(delivery_status,created_at);

-- This is callable ONLY by the Supabase service role on the trusted Netlify server.
create or replace function public.m4d_claim_push_events(batch_size integer default 12)
returns setof public.m4d_push_events
language plpgsql security definer set search_path=public as $$
begin
  return query
    with picked as (
      select id from public.m4d_push_events
      where delivery_status='pending' and attempts < 4
      order by created_at asc
      limit greatest(1, least(coalesce(batch_size,12),30))
      for update skip locked
    )
    update public.m4d_push_events e
    set delivery_status='processing', attempts=e.attempts+1
    from picked p where e.id=p.id
    returning e.*;
end $$;
revoke all on function public.m4d_claim_push_events(integer) from PUBLIC, anon, authenticated;
grant execute on function public.m4d_claim_push_events(integer) to service_role;

-- Generic privacy-first alert: never put message contents in push payloads.
create or replace function public.m4d_notify_direct_message()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.sender_id is distinct from new.recipient_id then
   insert into public.m4d_push_events(recipient_id,category,title,body,target_url,source_key)
   values(new.recipient_id,'messages','💬 New M4D message',
    'You have a new private message. Open M4D to read it.', '/#m4dMessages', 'message:'||new.id::text)
   on conflict (source_key) where source_key is not null do nothing;
 end if;
 return new;
end $$;
drop trigger if exists m4d_notify_direct_message on public.m4d_messages;
create trigger m4d_notify_direct_message after insert on public.m4d_messages
for each row execute function public.m4d_notify_direct_message();

create or replace function public.m4d_notify_friendship()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' and new.status='pending' then
   insert into public.m4d_push_events(recipient_id,category,title,body,target_url,source_key)
   values(new.recipient_id,'friends','👥 New friend request',
    'Someone sent you a friend request on M4D.', '/#m4dFriends','friend-request:'||new.id::text)
   on conflict (source_key) where source_key is not null do nothing;
 elsif tg_op='UPDATE' and new.status='accepted' and old.status is distinct from 'accepted' then
   insert into public.m4d_push_events(recipient_id,category,title,body,target_url,source_key)
   values(new.requester_id,'friends','✅ Friend request accepted',
    'Your M4D friend request was accepted.','/#m4dFriends','friend-accepted:'||new.id::text)
   on conflict (source_key) where source_key is not null do nothing;
 end if;
 return new;
end $$;
drop trigger if exists m4d_notify_friendship on public.friendships;
create trigger m4d_notify_friendship after insert or update of status on public.friendships
for each row execute function public.m4d_notify_friendship();

-- Alert once when an admin flips the MANUAL livestream status from offline to live.
-- Automatic YouTube-based detection requires a separate authorized event source.
create or replace function public.m4d_notify_manual_livestream()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.manual_enabled is true and new.manual_live is true
    and (old.manual_live is distinct from true or old.manual_enabled is distinct from true) then
   insert into public.m4d_push_events(recipient_id,category,title,body,target_url,source_key)
   values(null,'live','🔴 M4D IS LIVE!',
     left(coalesce(nullif(new.stream_title,''),'Markis & Christian are live! Tap to watch.'),240),
     case when new.stream_url ~ '^https://(www\.)?(youtube\.com|youtu\.be)/' then new.stream_url else '/#m4dLiveQueue' end,
     'manual-live:'||coalesce(new.updated_at::text,clock_timestamp()::text));
 end if;
 return new;
end $$;
drop trigger if exists m4d_notify_manual_livestream on public.m4d_live_settings;
create trigger m4d_notify_manual_livestream after update on public.m4d_live_settings
for each row execute function public.m4d_notify_manual_livestream();

-- Existing RLS on m4d_push_events and service-only inserts remain unchanged.
