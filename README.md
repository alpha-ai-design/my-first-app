# Xu Noodles — Delivery Ordering App

A mobile-first delivery ordering site for **Xu Noodles** (Indo-Chinese), built with Next.js (App Router), TypeScript and Tailwind CSS.

Customers can browse the menu, filter veg-only, search dishes, pick Half/Full portions, build a cart (saved in the browser) and place a delivery order, then watch its status. The restaurant is delivery only, paid on delivery (cash or UPI). Menu, settings and orders are stored in Supabase. There is no login or online payment.

## Run it locally

```bash
npm install
npm run dev      # open http://localhost:3000
npm run build    # production build (must pass before deploying)
```

## Supabase

The menu page loads dishes from the Supabase `menu_items` table.

1. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase → Project Settings → API). Set the same two variables on your host when deploying.
2. Run [`supabase/seed.sql`](supabase/seed.sql) once in the Supabase SQL editor to add the `emoji` column and load the current menu.
3. Edit the pincode line in [`supabase/updates.sql`](supabase/updates.sql), then run it **once** in the SQL editor. It deletes all test orders, adds the `restaurant_settings` table, changes `orders` to delivery-only and adds the `place_order` and `get_order_status` functions. Don't run it again once real orders exist: it deletes all orders.

`category` must be one of the category ids below (e.g. `soups`). Dishes with both `price_half` and `price_full` get a Half/Full choice. Set `sold_out_until` to a future time to show a dish as sold out until then.

Delivery pincodes, delivery fee, minimum order and default prep time are in the single `restaurant_settings` row (edit it in the table editor).

Orders are saved to `orders` / `order_items` with status `pending`. The customer's status page updates within 5 seconds when the owner changes `status` to:

- `accepted` (set `prep_minutes` and `accepted_at`): shows "Arriving in about X minutes"
- `rejected` (set `reject_reason`)
- `cancelled`: only for an accepted order that failed, e.g. customer not home or refused to pay (set `reject_reason` and `cancelled_at`)

## Editing the menu (data/menu.ts)

The category list and order, card colours and GST rate live in [`data/menu.ts`](data/menu.ts). If you change `GST_RATE`, change the `0.05` in `place_order` (`supabase/updates.sql`) too. The dish list in that file is only used for the original seed and card colours.

### Change, add or remove dishes

Edit the `menu_items` table in the Supabase table editor. Prices are whole rupees before GST. The menu updates on the next page load.

### Add, rename or reorder categories

Edit the `categories` list near the top of the file. The order there is the order of the tabs and sections.

To add a new category:

1. Add its id to the `CategoryId` type, e.g. `| "chopsuey"`.
2. Add `{ id: "chopsuey", name: "Chopsuey", emoji: "🥢" }` to `categories`.
3. Set `category` to `chopsuey` on those dishes in `menu_items`.

Empty categories are hidden automatically.

### GST

The tax rate is `GST_RATE` at the bottom of `data/menu.ts` (currently 5%).

## Project layout

```
app/page.tsx            Menu page (tabs, search, veg filter)
app/cart/page.tsx       Cart and bill summary
app/checkout/page.tsx   Delivery details and place order
app/order/[id]/page.tsx Order status page
components/             Header, logo, item card, portion picker, cart bar
lib/cart.tsx            Cart state (saved to localStorage)
lib/menu.tsx            Loads the menu from Supabase
lib/orders.ts           place_order / get_order_status calls
lib/settings.ts         Delivery pincodes, fee and minimum order
lib/customer.ts         Name, phone and address remembered on the phone
supabase/               seed.sql and updates.sql
data/menu.ts            ← the menu
```
