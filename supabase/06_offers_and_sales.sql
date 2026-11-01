-- Xu Noodles: offers (owner Offers tab + discounts at checkout) and the owner Sales tab.
-- Run once in the Supabase SQL editor, after 05_push.sql. Safe to run again.
--
-- This file does NOT delete any data. It:
--   1. makes sure the offers table has the columns and checks the app uses (adds only what is missing),
--   2. lets anyone read offers; only signed-in staff can create, change or stop them,
--   3. adds offer_id to orders and offer_id + discount to order_items, for offer reports,
--   4. replaces place_order (applies offers; refuses the order if the total the customer saw is out of date),
--   5. replaces get_order_status (now also returns discount),
--   6. adds sales_summary(period) for the Sales tab (signed-in staff only).
--
-- New checks are added as NOT VALID: they apply to every new or changed offer, but don't
-- reject offers that already exist.

begin;

-- 1. Offers table ------------------------------------------------------------------------

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text,
  type text not null,                   -- 'percent' or 'flat'
  value numeric not null,               -- % off (1-90) or ₹ off (> 0)
  applies_to text not null,             -- 'item', 'category' or 'order'
  target text,                          -- dish id (item) or category (category); empty for order
  min_order numeric not null default 0, -- order offers: subtotal after dish discounts must reach this
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.offers
  add column if not exists title text,
  add column if not exists type text,
  add column if not exists value numeric,
  add column if not exists applies_to text,
  add column if not exists target text,
  add column if not exists min_order numeric default 0,
  add column if not exists starts_at timestamptz default now(),
  add column if not exists ends_at timestamptz,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now();

alter table public.offers drop constraint if exists offers_type_check;
alter table public.offers add constraint offers_type_check check (type in ('percent', 'flat')) not valid;
alter table public.offers drop constraint if exists offers_applies_to_check;
alter table public.offers add constraint offers_applies_to_check check (applies_to in ('item', 'category', 'order')) not valid;
alter table public.offers drop constraint if exists offers_value_check;
alter table public.offers add constraint offers_value_check
  check ((type = 'percent' and value between 1 and 90) or (type = 'flat' and value > 0)) not valid;
alter table public.offers drop constraint if exists offers_dates_check;
alter table public.offers add constraint offers_dates_check
  check (ends_at is not null and starts_at is not null and ends_at > starts_at) not valid;
alter table public.offers drop constraint if exists offers_target_check;
alter table public.offers add constraint offers_target_check
  check (applies_to = 'order' or nullif(trim(target), '') is not null) not valid;

-- 2. Who can see and change offers --------------------------------------------------------------

alter table public.offers enable row level security;
drop policy if exists "Anyone can read offers" on public.offers;
create policy "Anyone can read offers" on public.offers
  for select to anon, authenticated using (true);
drop policy if exists "Staff can create offers" on public.offers;
create policy "Staff can create offers" on public.offers
  for insert to authenticated with check (true);
drop policy if exists "Staff can change offers" on public.offers;
create policy "Staff can change offers" on public.offers
  for update to authenticated using (true) with check (true);
grant select on public.offers to anon, authenticated;
grant insert, update on public.offers to authenticated;

-- 3. Which offer each order and dish used ------------------------------------------------------
-- offer_id has the same type as offers.id (uuid or number, whichever the table uses).

do $$
declare
  v_type text := (select format_type(a.atttypid, a.atttypmod) from pg_attribute a
                  where a.attrelid = 'public.offers'::regclass and a.attname = 'id' and not a.attisdropped);
begin
  execute format('alter table public.orders add column if not exists offer_id %s references public.offers(id) on delete set null', v_type);
  execute format('alter table public.order_items add column if not exists offer_id %s references public.offers(id) on delete set null', v_type);
end;
$$;

-- The dish discount on each order line (order-level discount = orders.discount - sum of these).
alter table public.order_items add column if not exists discount numeric not null default 0;

-- 4. place_order with offers --------------------------------------------------------------------

drop function if exists public.place_order(text, text, text, text, text, text, text, jsonb);
drop function if exists public.place_order(text, text, text, text, text, text, text, jsonb, int);

create function public.place_order(
  p_customer_name text,
  p_customer_phone text,
  p_society text,
  p_tower text,
  p_flat_number text,
  p_landmark text,
  p_notes text,
  p_items jsonb,
  p_expected_total int default null -- the total the customer saw; must match
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_customer_name, '')), '');
  v_phone text := trim(coalesce(p_customer_phone, ''));
  v_society text := nullif(regexp_replace(trim(coalesce(p_society, '')), '\s+', ' ', 'g'), '');
  v_tower text := nullif(regexp_replace(trim(coalesce(p_tower, '')), '\s+', ' ', 'g'), '');
  v_flat text := nullif(regexp_replace(trim(coalesce(p_flat_number, '')), '\s+', ' ', 'g'), '');
  v_landmark text := nullif(trim(coalesce(p_landmark, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_settings restaurant_settings%rowtype;
  v_item jsonb;
  v_menu menu_items%rowtype;
  v_portion text;
  v_qty numeric;
  v_price numeric;
  v_subtotal numeric := 0;
  v_gst int;
  v_unit_disc numeric;
  v_line_offer public.offers.id%type;
  v_item_disc numeric := 0;
  v_order_offer public.offers.id%type;
  v_order_disc numeric := 0;
  v_discount numeric;
  v_total numeric;
  v_lines jsonb := '[]';
  v_order_id uuid;
begin
  select * into v_settings from restaurant_settings where id = 1;
  if not found then
    raise exception 'Online ordering is not set up yet. Please try again later.';
  end if;

  if v_name is null then
    raise exception 'Please enter your name.';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'Please use a shorter name (80 characters max).';
  end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Please enter a valid 10-digit mobile number (starts with 6, 7, 8 or 9).';
  end if;
  if v_society is null or v_tower is null or v_flat is null then
    raise exception 'Please enter your society, tower and flat number.';
  end if;
  if char_length(v_society) > 100 or char_length(v_tower) > 100 or char_length(v_flat) > 50 or char_length(coalesce(v_landmark, '')) > 200 then
    raise exception 'Please shorten your address.';
  end if;
  if char_length(coalesce(v_notes, '')) > 200 then
    raise exception 'Cooking instructions can be at most 200 characters.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Your order has too many lines. Please split it into smaller orders.';
  end if;

  -- Check every dish first, so a rejected order never uses up an order number.
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_menu from menu_items where id::text = v_item ->> 'menu_item_id';
    if not found then
      raise exception 'One of the dishes in your cart is no longer on the menu. Please remove it and try again.';
    end if;

    if v_menu.is_archived then
      raise exception '% is no longer on the menu. Please remove it and try again.', v_menu.name;
    end if;

    if v_menu.sold_out_until is not null and v_menu.sold_out_until > now() then
      raise exception '% is sold out right now. Please remove it and try again.', v_menu.name;
    end if;

    if jsonb_typeof(v_item -> 'quantity') is distinct from 'number' then
      raise exception 'Quantity for % must be between 1 and 20.', v_menu.name;
    end if;
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty <> trunc(v_qty) or v_qty < 1 or v_qty > 20 then
      raise exception 'Quantity for % must be between 1 and 20.', v_menu.name;
    end if;

    v_portion := lower(nullif(trim(coalesce(v_item ->> 'portion', '')), ''));
    if v_portion = 'half' then
      if v_menu.price_half is null then
        raise exception '% is not available as a half portion.', v_menu.name;
      end if;
      v_price := v_menu.price_half;
    elsif v_portion is null or v_portion = 'full' then
      v_price := v_menu.price_full;
      if v_price is null then
        raise exception '% has no price set. Please call the restaurant.', v_menu.name;
      end if;
      -- Single-price dishes have no portion.
      if v_menu.price_half is null then
        v_portion := null;
      else
        v_portion := 'full';
      end if;
    else
      raise exception 'Unknown portion "%" for %.', v_item ->> 'portion', v_menu.name;
    end if;

    -- Best dish discount: a dish offer beats a category offer; among equals, the bigger discount.
    -- A flat discount never takes a dish below ₹1.
    v_line_offer := null;
    v_unit_disc := 0;
    select o.id,
           case when o.type = 'percent' then round(v_price * o.value / 100.0)
                else least(o.value, v_price - 1) end
      into v_line_offer, v_unit_disc
    from public.offers o
    where o.is_active
      and now() between o.starts_at and o.ends_at
      and ((o.applies_to = 'item' and o.target = v_menu.id::text)
        or (o.applies_to = 'category' and lower(trim(o.target)) = lower(trim(v_menu.category))))
    order by (o.applies_to = 'item') desc, 2 desc, o.id::text
    limit 1;
    v_unit_disc := greatest(coalesce(v_unit_disc, 0), 0);
    if v_unit_disc = 0 then
      v_line_offer := null;
    end if;
    v_item_disc := v_item_disc + v_unit_disc * v_qty;

    v_lines := v_lines || jsonb_build_object(
      'menu_item_id', v_menu.id::text, 'name', v_menu.name, 'portion', v_portion,
      'quantity', v_qty::int, 'unit_price', v_price,
      'discount', v_unit_disc * v_qty, 'offer_id', v_line_offer::text
    );
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  if v_subtotal < v_settings.min_order then
    raise exception 'The minimum order is ₹%. Please add ₹% more.', v_settings.min_order, v_settings.min_order - v_subtotal;
  end if;

  -- At most one order-level offer: the biggest discount among those whose minimum is met
  -- by the subtotal after dish discounts.
  select o.id,
         case when o.type = 'percent' then round((v_subtotal - v_item_disc) * o.value / 100.0)
              else least(o.value, v_subtotal - v_item_disc) end
    into v_order_offer, v_order_disc
  from public.offers o
  where o.is_active
    and now() between o.starts_at and o.ends_at
    and o.applies_to = 'order'
    and v_subtotal - v_item_disc >= coalesce(o.min_order, 0)
  order by 2 desc, o.id::text
  limit 1;
  v_order_disc := greatest(coalesce(v_order_disc, 0), 0);
  if v_order_disc = 0 then
    v_order_offer := null;
  end if;

  v_discount := v_item_disc + v_order_disc;
  v_gst := round((v_subtotal - v_discount) * 0.05)::int;
  v_total := v_subtotal - v_discount + v_gst + v_settings.delivery_fee;

  -- The customer must have seen exactly this total (an offer may have just started or ended).
  if p_expected_total is null or v_total <> p_expected_total then
    raise exception 'PRICE_CHANGED: Prices changed because an offer just ended. Please check your new total.';
  end if;

  insert into orders (
    order_type, customer_name, customer_phone, society, tower, flat_number, landmark, notes,
    status, subtotal, discount, gst, delivery_fee, total, offer_id
  )
  values (
    'delivery', v_name, v_phone, v_society, v_tower, v_flat, v_landmark, v_notes,
    'pending', v_subtotal, v_discount, v_gst, v_settings.delivery_fee, v_total, v_order_offer
  )
  returning id into v_order_id;

  insert into order_items (order_id, menu_item_id, name, portion, quantity, unit_price, discount, offer_id)
  select v_order_id, m.id, l.value ->> 'name', l.value ->> 'portion', (l.value ->> 'quantity')::int, (l.value ->> 'unit_price')::numeric,
         (l.value ->> 'discount')::numeric, o.id
  from jsonb_array_elements(v_lines) with ordinality as l(value, n)
  join menu_items m on m.id::text = l.value ->> 'menu_item_id'
  left join public.offers o on o.id::text = l.value ->> 'offer_id'
  order by l.n;

  return v_order_id;
end;
$$;

revoke execute on function public.place_order(text, text, text, text, text, text, text, jsonb, int) from public;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb, int) to anon, authenticated;

-- 5. get_order_status (now with discount; still never the address or phone) ------------------------

drop function if exists public.get_order_status(uuid);

create function public.get_order_status(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order_number', order_number,
    'status', status,
    'reject_reason', reject_reason,
    'prep_minutes', prep_minutes,
    'accepted_at', accepted_at,
    'subtotal', subtotal,
    'discount', coalesce(discount, 0),
    'gst', gst,
    'delivery_fee', delivery_fee,
    'total', total,
    'notes', notes
  )
  from orders
  where id = p_order_id;
$$;

revoke execute on function public.get_order_status(uuid) from public;
grant execute on function public.get_order_status(uuid) to anon, authenticated;

-- 6. Sales -------------------------------------------------------------------------------------
-- Runs as the caller (security invoker), so it only sees what row level security allows:
-- signed-in staff can read orders; customers can't. Orders are counted by when they were placed.

create or replace function public.sales_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with o as (
    select * from orders where created_at >= p_from and created_at < p_to
  ),
  acc as (
    select * from o where status = 'accepted'
  ),
  sold as (
    select oi.* from order_items oi join acc on acc.id = oi.order_id
  ),
  line_disc as (
    select order_id, sum(discount) as d from sold group by order_id
  )
  select jsonb_build_object(
    'net_sales', coalesce((select sum(subtotal - coalesce(discount, 0)) from acc), 0),
    'order_count', (select count(*) from acc),
    'average_order_value', coalesce((select round(sum(subtotal - coalesce(discount, 0)) / nullif(count(*), 0)) from acc), 0),
    'gst_collected', coalesce((select sum(gst) from acc), 0),
    'delivery_fees', coalesce((select sum(delivery_fee) from acc), 0),
    'top_dishes', coalesce((
      select jsonb_agg(t order by t.quantity desc, t.name)
      from (select name, sum(quantity) as quantity from sold group by name order by 2 desc, 1 limit 5) t
    ), '[]'),
    'unsold_dishes', coalesce((
      select jsonb_agg(m.name order by m.name)
      from menu_items m
      where not coalesce(m.is_archived, false)
        and not exists (select 1 from sold where sold.menu_item_id = m.id)
    ), '[]'),
    'missed', coalesce((
      select jsonb_agg(t order by t.count desc, t.reason)
      from (
        select status, coalesce(nullif(trim(reject_reason), ''), 'No reason given') as reason,
               count(*) as count, sum(subtotal - coalesce(discount, 0)) as value
        from o where status in ('rejected', 'cancelled')
        group by 1, 2
      ) t
    ), '[]'),
    'offers', coalesce((
      select jsonb_agg(t order by t.discount desc)
      from (
        select f.id::text as offer_id, f.title, f.type, f.value, f.applies_to, f.target, f.min_order,
               count(distinct u.order_id) as orders, sum(u.discount) as discount
        from (
          -- dish/category offers: per line
          select oi.order_id, oi.offer_id, oi.discount from sold oi where oi.offer_id is not null
          union all
          -- order offers: what's left of the order discount after dish discounts
          select acc.id, acc.offer_id, coalesce(acc.discount, 0) - coalesce(ld.d, 0)
          from acc left join line_disc ld on ld.order_id = acc.id
          where acc.offer_id is not null
        ) u
        join offers f on f.id = u.offer_id
        group by f.id
      ) t
    ), '[]')
  );
$$;

create or replace function public.sales_summary(p_period text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_local timestamp := now() at time zone 'Asia/Kolkata'; -- wall-clock time in India
  v_from timestamp;   -- period start (IST)
  v_to timestamp;     -- period end (IST)
  v_cfrom timestamp;  -- comparison start (IST)
  v_cto timestamp;    -- comparison end (IST)
  v_label text;
begin
  case p_period
    when 'today' then
      v_from := date_trunc('day', v_local); v_to := v_local;
      v_cfrom := v_from - interval '7 days'; v_cto := v_to - interval '7 days';
      v_label := 'last ' || trim(to_char(v_local, 'FMDay'));
    when 'yesterday' then
      v_from := date_trunc('day', v_local) - interval '1 day'; v_to := date_trunc('day', v_local);
      v_cfrom := v_from - interval '7 days'; v_cto := v_to - interval '7 days';
      v_label := 'last ' || trim(to_char(v_from, 'FMDay'));
    when 'this_week' then
      v_from := date_trunc('week', v_local); v_to := v_local; -- weeks start on Monday
      v_cfrom := v_from - interval '7 days'; v_cto := v_to - interval '7 days';
      v_label := 'last week';
    when 'this_month' then
      v_from := date_trunc('month', v_local); v_to := v_local;
      v_cfrom := v_from - interval '1 month';
      v_cto := least(v_to - interval '1 month', v_from); -- same day of last month (or its last day)
      v_label := 'last month';
    else
      raise exception 'Unknown period %. Use today, yesterday, this_week or this_month.', p_period;
  end case;

  return jsonb_build_object(
    'period', p_period,
    'from', v_from at time zone 'Asia/Kolkata',
    'to', v_to at time zone 'Asia/Kolkata',
    'compare_label', v_label,
    'current', sales_metrics(v_from at time zone 'Asia/Kolkata', v_to at time zone 'Asia/Kolkata'),
    'previous', sales_metrics(v_cfrom at time zone 'Asia/Kolkata', v_cto at time zone 'Asia/Kolkata')
  );
end;
$$;

revoke execute on function public.sales_metrics(timestamptz, timestamptz) from public, anon;
revoke execute on function public.sales_summary(text) from public, anon;
grant execute on function public.sales_metrics(timestamptz, timestamptz) to authenticated;
grant execute on function public.sales_summary(text) to authenticated;

commit;
