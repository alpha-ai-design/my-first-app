-- Xu Noodles: switch to DELIVERY ONLY (pay on delivery, cash or UPI).
-- Run ONCE in the Supabase SQL editor, after seed.sql. It replaces the old orders.sql functions.
-- WARNING: step (a) deletes ALL orders. Do not run it again once real orders are coming in.
--
-- Delivery is only to residents of Gaur City 2 (Greater Noida West) and nearby societies
-- listed in restaurant_settings.delivery_areas.
--
-- Everything runs in one transaction: if any step fails, nothing is changed.

begin;

-- a) Remove all test orders --------------------------------------------------------------

delete from order_items;
delete from orders;

-- b) Restaurant settings (single row) -----------------------------------------------------

create table if not exists restaurant_settings (
  id int primary key default 1 check (id = 1), -- only one row allowed
  delivery_areas text[] not null default '{}', -- societies we deliver to (checkout lists Gaur City 2 first)
  delivery_fee int not null default 0 check (delivery_fee >= 0),
  min_order int not null default 0 check (min_order >= 0),
  default_prep_minutes int not null default 40 check (default_prep_minutes > 0)
);

insert into restaurant_settings (id, delivery_areas)
values (1, '{"Gaur City 2"}')
on conflict (id) do update set delivery_areas = excluded.delivery_areas;

alter table restaurant_settings enable row level security;

drop policy if exists "Anyone can read settings" on restaurant_settings;
create policy "Anyone can read settings" on restaurant_settings
  for select to anon, authenticated using (true);

drop policy if exists "Signed-in users can update settings" on restaurant_settings;
create policy "Signed-in users can update settings" on restaurant_settings
  for update to authenticated using (true) with check (true);

revoke all on restaurant_settings from anon, authenticated;
grant select on restaurant_settings to anon, authenticated;
grant update on restaurant_settings to authenticated;

-- c) Orders: delivery only ----------------------------------------------------------------

alter table orders drop column if exists table_number;

-- Drop old check constraints on order_type / status so the new rules below can replace them.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%order_type%' or pg_get_constraintdef(oid) ilike '%status%')
  loop
    execute format('alter table orders drop constraint %I', c.conname);
  end loop;
end;
$$;

-- Plain text columns with a check (works whether they were text or an enum before).
alter table orders
  alter column order_type drop default,
  alter column order_type type text using order_type::text,
  alter column order_type set default 'delivery',
  alter column order_type set not null,
  add constraint orders_order_type_check check (order_type = 'delivery');

alter table orders
  alter column status drop default,
  alter column status type text using status::text,
  alter column status set default 'pending',
  alter column status set not null,
  -- 'cancelled' is only for an accepted order that failed (customer not home, refused to pay).
  -- reject_reason holds the reason for both 'rejected' and 'cancelled'.
  add constraint orders_status_check check (status in ('pending', 'accepted', 'rejected', 'cancelled'));

alter table orders
  alter column customer_name set not null,
  alter column customer_phone set not null;

alter table orders
  add column if not exists society text,
  add column if not exists tower text,       -- tower / block
  add column if not exists flat_number text,
  add column if not exists landmark text,    -- gate / landmark (optional)
  add column if not exists notes text,
  add column if not exists gst int,
  add column if not exists delivery_fee int,
  add column if not exists order_number bigint generated always as identity,
  add column if not exists cancelled_at timestamptz;

create unique index if not exists orders_order_number_key on orders (order_number);

-- d) place_order --------------------------------------------------------------------------

drop function if exists public.place_order(text, text, text, text, jsonb);
drop function if exists public.place_order(text, text, text, text, text, text, text, jsonb);

create function public.place_order(
  p_customer_name text,
  p_customer_phone text,
  p_society text,
  p_tower text,
  p_flat_number text,
  p_landmark text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_customer_name, '')), '');
  v_phone text := trim(coalesce(p_customer_phone, ''));
  v_society text := nullif(trim(coalesce(p_society, '')), '');
  v_tower text := nullif(trim(coalesce(p_tower, '')), '');
  v_flat text := nullif(trim(coalesce(p_flat_number, '')), '');
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
    raise exception 'Please choose your society and enter your tower and flat number.';
  end if;
  -- Store the society exactly as written in delivery_areas.
  select a into v_society from unnest(v_settings.delivery_areas) as a where lower(a) = lower(v_society) limit 1;
  if v_society is null then
    raise exception 'Sorry, we only deliver within Gaur City 2 and nearby societies.';
  end if;
  if char_length(v_tower) > 100 or char_length(v_flat) > 50 or char_length(coalesce(v_landmark, '')) > 200 then
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

    v_lines := v_lines || jsonb_build_object(
      'menu_item_id', v_menu.id::text, 'name', v_menu.name, 'portion', v_portion,
      'quantity', v_qty::int, 'unit_price', v_price
    );
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  if v_subtotal < v_settings.min_order then
    raise exception 'The minimum order is ₹%. Please add ₹% more.', v_settings.min_order, v_settings.min_order - v_subtotal;
  end if;

  v_gst := round(v_subtotal * 0.05)::int;

  insert into orders (
    order_type, customer_name, customer_phone, society, tower, flat_number, landmark, notes,
    status, subtotal, discount, gst, delivery_fee, total
  )
  values (
    'delivery', v_name, v_phone, v_society, v_tower, v_flat, v_landmark, v_notes,
    'pending', v_subtotal, 0, v_gst, v_settings.delivery_fee, v_subtotal + v_gst + v_settings.delivery_fee
  )
  returning id into v_order_id;

  insert into order_items (order_id, menu_item_id, name, portion, quantity, unit_price)
  select v_order_id, m.id, l.value ->> 'name', l.value ->> 'portion', (l.value ->> 'quantity')::int, (l.value ->> 'unit_price')::numeric
  from jsonb_array_elements(v_lines) with ordinality as l(value, n)
  join menu_items m on m.id::text = l.value ->> 'menu_item_id'
  order by l.n;

  return v_order_id;
end;
$$;

-- e) get_order_status (never returns address or phone) -------------------------------------

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
    'gst', gst,
    'delivery_fee', delivery_fee,
    'total', total,
    'notes', notes
  )
  from orders
  where id = p_order_id;
$$;

-- f) Who can call the functions ------------------------------------------------------------

revoke execute on function public.place_order(text, text, text, text, text, text, text, jsonb) from public;
revoke execute on function public.get_order_status(uuid) from public;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.get_order_status(uuid) to anon, authenticated;

commit;
