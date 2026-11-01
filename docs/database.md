# Database (Supabase)

Everything lives in one Supabase project: dishes, orders, offers, settings, owner login and the list of phones that receive order alerts. The schema is built by the SQL files in [`supabase/`](../supabase), run **in order** in the Supabase **SQL Editor** (left menu → SQL Editor → New query → paste → Run).

## Summary

| # | File | Deletes data? | Safe to re-run? |
| --- | --- | --- | --- |
| 0 | *Starting tables* (below; not a file) | No | Only on an empty project |
| 1 | [`seed.sql`](../supabase/seed.sql) | No | ⚠️ Not after the owner starts editing the menu (see below) |
| 2 | [`updates.sql`](../supabase/updates.sql) | **Yes, deletes ALL orders** | ❌ **Never** once real orders exist |
| 3 | [`02_free_text_society.sql`](../supabase/02_free_text_society.sql) | No | ❌ Not after files 5–7 (it would install an older `place_order`) |
| 4 | [`03_owner_orders.sql`](../supabase/03_owner_orders.sql) | No | ✅ Yes |
| 5 | [`04_menu.sql`](../supabase/04_menu.sql) | No | ❌ Not after file 7 (it would install an older `place_order`) |
| 6 | [`05_push.sql`](../supabase/05_push.sql) | No | ✅ Yes |
| 7 | [`06_offers_and_sales.sql`](../supabase/06_offers_and_sales.sql) | No | ✅ Yes (it holds the current `place_order`) |

**Why "older `place_order`" matters.** Files 2, 3, 5 and 7 each replace the database function that places orders (`place_order`), and each version builds on the one before. Running an older file after a newer one quietly puts an old version back. For example, re-running `04_menu.sql` after `06_offers_and_sales.sql` removes offers and the "expected total" check, and **checkout stops working**. If an older file was re-run by mistake, run `06_offers_and_sales.sql` again to restore the current version.

**Adding changes later:** create a new numbered file (`07_….sql`) instead of editing a file that has already been run. Say at the top what it does, whether it deletes data and whether it is safe to re-run.

## 0. Starting tables (only for a brand-new project)

The first version of the app used three tables that were created by hand in the Supabase dashboard, so no file in `supabase/` creates them. To rebuild from scratch, run this once in an empty project **before** `seed.sql`. It contains only the columns the later files and the app expect; the later files add the rest.

> This was reconstructed from the code and tested together with all the files below on an empty Postgres database. If you are working on the existing live project, **don't run it**; the tables already exist.

```sql
-- Starting tables for a brand-new Xu Noodles project. Run once, before seed.sql.
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,              -- category id from data/menu.ts, e.g. 'soups'
  description text,
  price_half numeric,                  -- empty when the dish has no Half/Full choice
  price_full numeric,                  -- the price (or the Full price)
  is_veg boolean not null,
  spice_level int not null default 0,  -- 0 none, 1 mild, 2 medium, 3 hot
  is_bestseller boolean not null default false,
  sold_out_until timestamptz           -- sold out until this time; empty = available
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_type text not null,
  table_number text,                   -- removed again by updates.sql
  customer_name text,
  customer_phone text,
  status text not null default 'pending',
  subtotal numeric,
  discount numeric,
  total numeric,
  reject_reason text,
  prep_minutes int,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  menu_item_id uuid references public.menu_items (id),
  name text not null,                  -- dish name at the time of ordering
  portion text,                        -- 'half', 'full' or empty
  quantity int not null,
  unit_price numeric not null          -- price at the time of ordering
);
```

## 1. `seed.sql`: the menu

- Adds `menu_items.emoji` and inserts the 32 original dishes (names, categories, prices, veg/non-veg, spice, bestseller, emoji).
- Skips any dish whose name already exists, so running it twice doesn't duplicate dishes.
- **Deletes nothing.**
- **Re-running:** only on a fresh project. Once the owner renames or removes dishes in the Menu tab, re-running would add the original dishes back.

## 2. `updates.sql`: delivery-only switch

> ⚠️ **Deletes every order** (`delete from order_items; delete from orders;`). It was written to clear test orders before going live. **Never run it again** once real orders exist.

What it does, in one transaction (if any step fails, nothing changes):

1. Deletes all orders and order items.
2. Creates `restaurant_settings`: a single row (id = 1) with `delivery_fee`, `min_order` and `default_prep_minutes`, plus `delivery_areas`, which is no longer used. Anyone can read it; only signed-in users can update it.
3. Makes `orders` delivery-only:
   - **Removes** `table_number`.
   - `order_type` is always `'delivery'`, and name and phone are required.
   - Allowed statuses become `pending`, `accepted`, `rejected` and `cancelled`.
   - Adds the address (`society`, `tower`, `flat_number`, `landmark`), `notes`, `gst`, `delivery_fee`, an automatic `order_number` (1, 2, 3 …) and `cancelled_at`.
4. Creates `place_order` (version 1) and `get_order_status`.

## 3. `02_free_text_society.sql`: customers type their society

- Replaces `place_order` (version 2): any society name is accepted, and the owner rejects orders that are too far away.
- **Deletes nothing.**
- **Re-running:** don't, after files 5–7.

## 4. `03_owner_orders.sql`: owner Orders screen

- **Live updates:** adds `orders` to Supabase Realtime, so new orders appear on the owner screen instantly.
- **Row level security:** turned on for `orders`, `order_items` and `menu_items`:
  - Signed-in staff can read and update orders and read order items.
  - Everyone can read the menu; only staff can change it.
- **Auto-reject job:** turns on `pg_cron` and adds a job that runs every minute. It rejects orders still `pending` 8 minutes after they were placed, with the reason "Restaurant didn't respond".
- **Deletes nothing.**
- **Re-running:** safe; the job is replaced, not duplicated.

## 5. `04_menu.sql`: owner Menu tab

- Adds `menu_items.is_archived` ("Remove from menu"; existing dishes start as not archived).
- Lets signed-in staff add dishes. Nobody can delete dishes, so past orders keep their dishes.
- Replaces `place_order` (version 3): archived dishes can't be ordered.
- **Deletes nothing.**
- **Re-running:** don't, after file 7.

## 6. `05_push.sql`: order alerts

- Creates `push_subscriptions`: one row per phone that has alerts turned on, holding the push address and its keys.
- Only signed-in staff can read, add or remove rows. The Edge Function uses the service role, which bypasses these rules.
- **Deletes nothing.**
- **Re-running:** safe.

## 7. `06_offers_and_sales.sql`: offers and sales

- **Offers table:** creates `offers` if it's missing, and otherwise adds only missing columns. It adds checks for new or changed offers:
  - `type` is `percent` or `flat`.
  - Percent is 1–90; flat is above 0.
  - `ends_at` is after `starts_at`.
  - Dish and category offers need a `target`.

  Existing offers aren't re-checked. Anyone can read offers; only staff can create or change them.
- **Offer reporting:** adds `orders.offer_id`, `order_items.offer_id` and `order_items.discount`.
- **`place_order` (current, version 4):**
  - **Dish discounts:** each dish gets at most one discount, and a dish offer beats a category offer. A flat discount never takes a dish below ₹1.
  - **Order discount:** at most one order offer applies, the biggest one whose minimum is met by the subtotal after dish discounts.
  - **GST:** 5% of (subtotal − discount), rounded to the rupee.
  - **Expected total:** the order is refused with `PRICE_CHANGED` if the total differs from the one the customer saw (`p_expected_total`).
- **`get_order_status`:** now also returns `discount`.
- **Sales:** adds `sales_summary(period)` and its helper `sales_metrics`, for the Sales tab. Signed-in staff only, with IST day boundaries.
- **Deletes nothing.**
- **Re-running:** safe.

## Tables at a glance (after all files)

| Table | Holds | Customers (not signed in) | Owner (signed in) |
| --- | --- | --- | --- |
| `menu_items` | Dishes, prices, sold-out time, archived flag | Read | Read, add, change (no delete) |
| `offers` | Discounts with start and end times | Read | Read, add, change / stop (no delete) |
| `restaurant_settings` | One row: delivery fee, minimum order, default prep time | Read | Read, change |
| `orders` | Orders, address, totals, status | ❌ (only through `place_order` and `get_order_status`) | Read, change status |
| `order_items` | Dishes in each order, prices at the time | ❌ | Read |
| `push_subscriptions` | Phones that receive order alerts | ❌ | Read, add, remove |

## Database functions

| Function | Who can call it | What it does |
| --- | --- | --- |
| `place_order(...)` | Anyone | Checks everything and saves the order. Checks: name, 10-digit Indian mobile, address, notes length, every dish exists, isn't archived or sold out, half portion allowed, quantity 1–20, minimum order. Prices come from `menu_items` and `offers`, never from the browser. Refuses a stale total with `PRICE_CHANGED`. Returns the new order id. |
| `get_order_status(order_id)` | Anyone with the order id | Returns order number, status, reason, prep time, accepted time, subtotal, discount, GST, delivery fee, total and notes. **Never** the address or phone. |
| `sales_summary(period)` | Signed-in staff only | Sales report for `today`, `yesterday`, `this_week` or `this_month`, compared with the matching earlier period. |
| `sales_metrics(from, to)` | Signed-in staff only | Helper used by `sales_summary`. |

## Settings you can change in the Table Editor

`restaurant_settings` (the single row):

- `delivery_fee`: added to every order (₹). 0 = free delivery.
- `min_order`: minimum subtotal before discounts (₹). 0 = no minimum.
- `default_prep_minutes`: stored, but the Orders screen currently asks for 30 / 40 / 50 minutes instead.
- `delivery_areas`: no longer used.

The GST rate (5%) is fixed in two places that must match: `place_order` in SQL and `GST_PERCENT` in `lib/pricing.ts`.
