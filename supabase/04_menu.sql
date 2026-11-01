-- Xu Noodles: owner's Menu tab.
-- Run once in the Supabase SQL editor, after 03_owner_orders.sql. Safe to run again.
--
-- This file does NOT delete or change any existing dishes or orders. It:
--   1. adds menu_items.is_archived ("Remove from menu"; every existing dish starts as not archived),
--   2. lets signed-in staff add new dishes (they could already update them; nobody can delete),
--   3. replaces place_order so archived dishes can't be ordered. Everything else is unchanged.

begin;

-- 1. Archived dishes ----------------------------------------------------------------------

alter table public.menu_items add column if not exists is_archived boolean not null default false;

-- 2. Staff can add dishes -----------------------------------------------------------------

drop policy if exists "Staff can add dishes" on public.menu_items;
create policy "Staff can add dishes" on public.menu_items
  for insert to authenticated with check (true);
grant insert on public.menu_items to authenticated;

-- 3. place_order: refuse archived dishes ------------------------------------------------------

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

revoke execute on function public.place_order(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb) to anon, authenticated;

commit;
