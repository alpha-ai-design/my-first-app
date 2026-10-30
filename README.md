# Xu Noodles — Delivery Ordering App

A mobile-first delivery ordering site for **Xu Noodles** (Indo-Chinese), built with Next.js (App Router), TypeScript and Tailwind CSS.

Customers can browse the menu, filter veg-only, search dishes, pick Half/Full portions, build a cart (saved in the browser) and place a delivery order, then watch its status. The restaurant is delivery only, paid on delivery (cash or UPI). Menu, settings and orders are stored in Supabase. There is no login or online payment.

## Run it locally

```bash
npm install
npm run dev      # open http://localhost:3000
npm run build    # production build (must pass before deploying)
npm run lint     # type check + React hook rules (catches "Rendered more hooks" crashes before they ship)
```

## Supabase

The menu page loads dishes from the Supabase `menu_items` table.

1. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase → Project Settings → API). Set the same two variables on your host when deploying.
2. Run [`supabase/seed.sql`](supabase/seed.sql) once in the Supabase SQL editor to add the `emoji` column and load the current menu.
3. Run [`supabase/updates.sql`](supabase/updates.sql) **once** in the SQL editor. It deletes all test orders, adds the `restaurant_settings` table, changes `orders` to delivery-only and adds the `place_order` and `get_order_status` functions. Don't run it again once real orders exist: it deletes all orders.
4. Run [`supabase/02_free_text_society.sql`](supabase/02_free_text_society.sql). It only replaces `place_order` so customers can type any society name. It doesn't delete or change any data.
5. Run [`supabase/03_owner_orders.sql`](supabase/03_owner_orders.sql). It turns on live updates for `orders`, lets signed-in staff read/update orders and mark dishes sold out (customers can still only read the menu), and adds a job that auto-rejects orders still pending after 8 minutes. It doesn't delete or change any data.
6. Run [`supabase/04_menu.sql`](supabase/04_menu.sql). It adds `menu_items.is_archived` ("Remove from menu"), lets signed-in staff add dishes, and stops archived dishes being ordered. It doesn't delete or change any data.
7. Run [`supabase/05_push.sql`](supabase/05_push.sql). It adds the `push_subscriptions` table (phones that turned on order notifications). It doesn't change any other data.
8. Run [`supabase/06_offers_and_sales.sql`](supabase/06_offers_and_sales.sql). It sets up offers (anyone can read them; only staff can create or stop them), records which offer each order used, makes `place_order` apply offers, and adds `sales_summary` for the Sales tab. It doesn't delete any data.

`category` must be one of the category ids below (e.g. `soups`). Dishes with both `price_half` and `price_full` get a Half/Full choice. Set `sold_out_until` to a future time to show a dish as sold out until then.

We deliver within about 3 km of Gaur City 2 (Greater Noida West). At checkout customers type their society, tower and flat number; there is no list of allowed societies, so the owner rejects orders that are too far away. The single `restaurant_settings` row holds the delivery fee, minimum order and default prep time (edit it in the table editor). Its `delivery_areas` column is no longer used.

Orders are saved to `orders` / `order_items` with status `pending`. The customer's status page updates within 5 seconds when the owner changes `status` to:

- `accepted` (set `prep_minutes` and `accepted_at`): shows "Arriving in about X minutes"
- `rejected` (set `reject_reason`)
- `cancelled`: only for an accepted order that failed, e.g. customer not home or refused to pay (set `reject_reason` and `cancelled_at`)

## Owner screen (/admin)

Open `/admin` on the kitchen phone and sign in. **Every signed-in user is treated as staff**, so:

1. In Supabase → Authentication → Sign In / Providers, turn **off** "Allow new users to sign up".
2. Create the owner's login in Authentication → Users → Add user (email + password). The password can be changed later in the app's Settings.

Tap **Start shift** to turn on the chime and keep the screen awake. The Orders tab shows:

- **New**: pending orders, oldest first. A chime plays every 10 seconds while any are waiting; after 3 minutes the card flashes and the chime gets louder. **Accept** uses `default_prep_minutes` from `restaurant_settings`, or tap 30 / 40 / 50 min. **Reject** asks for a reason; "Item sold out" also hides that dish until the next 6:00 am IST. Orders not answered in 8 minutes are rejected automatically ("Restaurant didn't respond").
- **Accepted today**: with **Print bill** (receipt for 58/80 mm printers or A4) and **Cancel** (customer not available / refused / other).

The **Menu** tab lists every dish by category (same order as the customer menu) with a search box:

- **Available / Sold out** switch: Sold out lasts until the next 6:00 am IST, with a 5-second Undo. Long-press the switch or tap **⋯** for "Sold out until I turn it back on".
- **+ Add dish** in each category, or tap a dish to edit it. Edit also has **Duplicate** and **Remove from menu** (hidden from customers; past orders are unaffected). Removed dishes can be restored from "Removed dishes" at the bottom.

### Order notifications (push)

New orders also arrive as phone notifications, even when the owner screen is closed (standard Web Push, no paid services).

- `/admin` is installable as the **Xu Kitchen** app (`public/admin.webmanifest`, icons in `public/icons/`). `public/sw.js` shows the notifications and opens `/admin` when one is tapped.
- The Supabase Edge Function [`supabase/functions/notify-new-order`](supabase/functions/notify-new-order/index.ts) runs on every new order (Database Webhook on INSERT into `orders`) and sends to every saved phone, removing phones that are no longer valid. It also sends the "Send test notification" from Settings.
- Keys: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in the website environment; `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (e.g. `mailto:you@example.com`) as Supabase Edge Function secrets. **Never commit the private key.**
- Turn notifications on from the Start shift screen or Settings. On iPhone this only works after "Add to Home Screen", opened from the home screen (iOS 16.4+).

The **Offers** tab lists Active, Scheduled and Ended offers (with **Stop now**) and creates new ones from three templates: % off a category, ₹ off a dish, or ₹ off orders above ₹X. Each offer needs an end date (Today only, This weekend, 7 days or a picked date, always 11:59 pm IST). A dish can only have one dish or category offer at a time.

Offer rules (in `place_order` and mirrored in `lib/pricing.ts`, which must stay in sync): each dish gets at most one discount and a dish offer beats a category offer; a flat discount never takes a dish below ₹1; at most one order-level offer applies (the biggest, once the subtotal after dish discounts reaches its minimum); GST is 5% of (subtotal − discount). The checkout sends the total the customer saw; if an offer started or ended meanwhile, the order is refused with `PRICE_CHANGED`, prices reload and the cart is kept.

The **Sales** tab shows Today, Yesterday, This week (from Monday) or This month, compared with the same point last week / last month: net sales (after discounts, without GST and delivery fees), orders, average order value, top dishes, dishes with no orders, missed sales by reason, and offer results.

All times and day boundaries are Indian time (IST).

## Design scale

One type scale is defined in `app/globals.css` and used everywhere: `text-caption` 13px (secondary), `text-body` 15px, `text-heading` 17px (sections, card titles), `text-title` 21px (page titles), `text-metric` 26px (Sales numbers); 12px only for small badges. Spacing uses Tailwind's 4px steps. Primary buttons (Accept, Reject, Place order, Start shift) are at least 44px tall on phones; other buttons and chips at least 36px. Owner screens use 2–3 column grids from 768px, a 1200px max width, and a top tab row instead of the bottom tab bar from 1024px.

## Editing the menu (data/menu.ts)

The category list and order and card colours live in [`data/menu.ts`](data/menu.ts). GST is set in `lib/pricing.ts` (`GST_PERCENT`) and in `place_order` (latest version: `supabase/06_offers_and_sales.sql`); change both together. The dish list in that file is only used for the original seed and card colours.

### Change, add or remove dishes

Use the **Menu** tab on the owner screen (`/admin/menu`). Prices are whole rupees before GST. Customers see changes the next time they load the menu.

### Add, rename or reorder categories

Edit the `categories` list near the top of the file. The order there is the order of the tabs and sections.

To add a new category:

1. Add its id to the `CategoryId` type, e.g. `| "chopsuey"`.
2. Add `{ id: "chopsuey", name: "Chopsuey", emoji: "🥢" }` to `categories`.
3. Set `category` to `chopsuey` on those dishes in `menu_items`.

Empty categories are hidden automatically.

### GST

GST is 5% (`GST_PERCENT` in `lib/pricing.ts` and the `0.05` in `place_order`; change both together).

## Project layout

```
app/page.tsx            Menu page (tabs, search, veg filter)
app/cart/page.tsx       Cart and bill summary
app/checkout/page.tsx   Delivery details and place order
app/order/[id]/page.tsx Order status page
app/admin/               Owner screen: login, orders, print bill, settings
components/admin/       Admin shell (sign-in check, shift, chime, tabs)
lib/admin/              Owner queries (orders, menu, offers, sales), IST time helpers, chime, push
lib/pricing.ts          Offer and price rules (must match place_order)
public/sw.js            Service worker for order notifications
supabase/functions/     notify-new-order Edge Function (Deno)
components/             Header, logo, item card, portion picker, cart bar
lib/cart.tsx            Cart state (saved to localStorage)
lib/menu.tsx            Loads the menu from Supabase
lib/orders.ts           place_order / get_order_status calls
lib/settings.ts         Delivery fee and minimum order
lib/customer.ts         Name, phone and address remembered on the phone
supabase/               seed.sql, updates.sql, 02_… to 06_offers_and_sales.sql (run in order)
data/menu.ts            ← the menu
```
