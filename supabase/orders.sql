-- Xu Noodles ordering functions. Run in the Supabase SQL editor (after seed.sql).
-- The orders, order_items and menu_items tables already exist; this only adds functions.
--
-- Assumed columns:
--   orders:      id (uuid), order_type, table_number, customer_name, customer_phone,
--                status, subtotal, discount, total, reject_reason, prep_minutes, accepted_at
--   order_items: order_id, menu_item_id, name, portion, quantity, unit_price
--
-- total = subtotal + 5% GST (rounded to whole rupees) - discount, matching the cart page.

create or replace function public.place_order(
  p_order_type text,
  p_table_number text,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := lower(trim(coalesce(p_order_type, '')));
  v_table text := nullif(trim(coalesce(p_table_number, '')), '');
  v_name text := nullif(trim(coalesce(p_customer_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_customer_phone, '')), '');
  v_item jsonb;
  v_menu menu_items%rowtype;
  v_portion text;
  v_qty numeric;
  v_price numeric;
  v_subtotal numeric := 0;
  v_order_id uuid;
begin
  if v_type not in ('dine_in', 'takeaway') then
    raise exception 'Please choose Dine-in or Takeaway.';
  end if;

  if v_type = 'dine_in' then
    if v_table is null then
      raise exception 'Please enter your table number.';
    end if;
  else
    if v_name is null or v_phone is null then
      raise exception 'Please enter your name and phone number for takeaway.';
    end if;
    v_table := null;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Your order has too many lines. Please split it into smaller orders.';
  end if;

  -- Totals are filled in after the items; any error below rolls the whole order back.
  insert into orders (order_type, table_number, customer_name, customer_phone, status, subtotal, discount, total)
  values (v_type, v_table, v_name, v_phone, 'pending', 0, 0, 0)
  returning id into v_order_id;

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
        raise exception '% has no price set. Please ask the staff.', v_menu.name;
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

    insert into order_items (order_id, menu_item_id, name, portion, quantity, unit_price)
    values (v_order_id, v_menu.id, v_menu.name, v_portion, v_qty::int, v_price);

    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  update orders
  set subtotal = v_subtotal,
      discount = 0,
      total = v_subtotal + round(v_subtotal * 0.05)
  where id = v_order_id;

  return v_order_id;
end;
$$;

create or replace function public.get_order_status(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'status', status,
    'reject_reason', reject_reason,
    'prep_minutes', prep_minutes,
    'accepted_at', accepted_at,
    'total', total
  )
  from orders
  where id = p_order_id;
$$;

revoke execute on function public.place_order(text, text, text, text, jsonb) from public;
revoke execute on function public.get_order_status(uuid) from public;
grant execute on function public.place_order(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.get_order_status(uuid) to anon, authenticated;
