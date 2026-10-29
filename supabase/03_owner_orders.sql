-- Xu Noodles: owner's Orders screen.
-- Run once in the Supabase SQL editor, after 02_free_text_society.sql. Safe to run again.
--
-- This file does NOT delete or change any existing rows. It:
--   1. sends new/changed orders to the owner's screen instantly (realtime),
--   2. lets signed-in staff read/update orders and mark dishes sold out (row level security),
--   3. auto-rejects orders nobody answers within 8 minutes (pg_cron, every minute).
--
-- IMPORTANT: every signed-in user counts as staff. In Supabase go to
-- Authentication → Sign In / Providers and turn OFF "Allow new users to sign up",
-- then create the owner's login under Authentication → Users → Add user.

begin;

-- 1. Realtime ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

-- 2. Who can see and change what ---------------------------------------------------------
-- Customers never touch orders directly: they go through place_order / get_order_status,
-- which are security definer and are not affected by these rules.

alter table public.orders enable row level security;
drop policy if exists "Staff can read orders" on public.orders;
create policy "Staff can read orders" on public.orders
  for select to authenticated using (true);
drop policy if exists "Staff can update orders" on public.orders;
create policy "Staff can update orders" on public.orders
  for update to authenticated using (true) with check (true);
grant select, update on public.orders to authenticated;

alter table public.order_items enable row level security;
drop policy if exists "Staff can read order items" on public.order_items;
create policy "Staff can read order items" on public.order_items
  for select to authenticated using (true);
grant select on public.order_items to authenticated;

-- Everyone can read the menu; only staff can change it (e.g. mark a dish sold out).
alter table public.menu_items enable row level security;
drop policy if exists "Anyone can read the menu" on public.menu_items;
create policy "Anyone can read the menu" on public.menu_items
  for select to anon, authenticated using (true);
drop policy if exists "Staff can update the menu" on public.menu_items;
create policy "Staff can update the menu" on public.menu_items
  for update to authenticated using (true) with check (true);
grant select on public.menu_items to anon, authenticated;
grant update on public.menu_items to authenticated;

commit;

-- 3. Auto-reject unanswered orders -------------------------------------------------------
-- Every minute: orders still 'pending' 8 minutes after they were placed are rejected,
-- so customers aren't left waiting. Re-running this file just replaces the same job.

create extension if not exists pg_cron;

select cron.schedule(
  'auto-reject-unanswered-orders',
  '* * * * *',
  $$
    update public.orders
    set status = 'rejected',
        reject_reason = 'Restaurant didn''t respond'
    where status = 'pending'
      and created_at < now() - interval '8 minutes'
  $$
);
