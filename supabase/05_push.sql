-- Xu Kitchen: push notifications for new orders.
-- Run once in the Supabase SQL editor, after 04_menu.sql. Safe to run again.
--
-- Creates the push_subscriptions table (one row per phone that turned on notifications).
-- It does NOT delete or change any other data.
--
-- Signed-in staff can save, read and remove subscriptions from the owner screen.
-- The notify-new-order Edge Function uses the service role key, which bypasses these rules.

begin;

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  endpoint text not null unique, -- the phone's push address
  p256dh text not null,          -- the phone's encryption key
  auth text not null,            -- the phone's auth secret
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Staff can read push subscriptions" on public.push_subscriptions;
create policy "Staff can read push subscriptions" on public.push_subscriptions
  for select to authenticated using (true);

drop policy if exists "Staff can add push subscriptions" on public.push_subscriptions;
create policy "Staff can add push subscriptions" on public.push_subscriptions
  for insert to authenticated with check (true);

drop policy if exists "Staff can remove push subscriptions" on public.push_subscriptions;
create policy "Staff can remove push subscriptions" on public.push_subscriptions
  for delete to authenticated using (true);

revoke all on public.push_subscriptions from anon;
revoke all on public.push_subscriptions from authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;

commit;
