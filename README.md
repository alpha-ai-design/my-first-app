# Xu Noodles: delivery ordering app

A mobile-first website for **Xu Noodles**, an Indo-Chinese kitchen that delivers within about 3 km of Gaur City 2 (Greater Noida West). Customers order from their phones and pay on delivery (cash or UPI). The owner runs the kitchen from a separate, installable owner screen.

There is no online payment and no customer login.

## What it does

### For customers (`/`)

- **Menu**: dishes grouped by category, with search, a "Veg only" filter, Veg / Non-veg labels, spice level, bestseller badges and Half / Full portions. Sold-out dishes are greyed out.
- **Offers**: discounted dishes show the old price struck through and a badge such as "20% off". Order offers show as a banner, for example "₹50 off on orders above ₹499".
- **Cart** (`/cart`): saved on the phone. Shows subtotal, offer discount, GST (5%), delivery fee and total, plus a hint like "Add ₹42 more to get ₹30 off".
- **Checkout** (`/checkout`): name, mobile number, society, tower / block, flat number, optional gate / landmark and cooking instructions. Details are remembered on the phone for next time. The button reads "Place order · Pay ₹X on delivery".
- **Order status** (`/order/<id>`): shows the order number and updates every 5 seconds: waiting for the restaurant, accepted (with an "Arriving in about X minutes" countdown), rejected (with the reason) or cancelled. It also shows the dishes, the cooking instructions and the price breakdown.

### For the owner (`/admin`)

Sign in with email and password. The screen opens straight on **Orders**.

- **Orders**:
  - **New orders** arrive live with a chime every 10 seconds; after 3 minutes the card flashes and the chime gets louder.
  - **Accept** by choosing 30 / 40 / 50 minutes and then tapping Accept.
  - **Reject** with a reason. "Item sold out" also hides that dish until 6:00 am IST.
  - **Accepted today** has **Print bill** (58/80 mm receipt printers or A4) and **Cancel** (customer not available, refused, other).
  - Orders not answered within 8 minutes are rejected automatically.
- **Menu**: an Available / Sold out switch for each dish (until 6:00 am, or until turned back on), plus Add, Edit, Duplicate and Remove from menu. Removed dishes can be restored.
- **Offers**: % off a category, ₹ off a dish, or ₹ off orders above ₹X, each with an end date. Shows Active, Scheduled and Ended offers, with "Stop now".
- **Sales**: Today, Yesterday, This week or This month, compared with the same point in the previous period. Shows net sales, orders, average order value, top dishes, dishes with no orders, missed sales and offer results.
- **Alerts**: a phone notification for every new order, even when the app is closed. The owner screen installs as the "Xu Kitchen" app. Alerts switch themselves on once allowed, and the header shows "🔔 Alerts on".
- **Settings**: change password, send a test notification, log out.

All times and day boundaries use Indian time (IST, Asia/Kolkata).

## Tech stack

| Part | What |
| --- | --- |
| Website | [Next.js 15](https://nextjs.org) (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Hosting | [Vercel](https://vercel.com): `main` is the live site; every other branch (for example `dev`) gets a preview link |
| Database, login, live updates | [Supabase](https://supabase.com): Postgres with row level security, Auth, Realtime, `pg_cron` |
| New-order notifications | Supabase Edge Function (Deno) + Database Webhook, standard Web Push with VAPID keys, a service worker on the owner's phone |
| Checks | `npm run lint` (TypeScript + React hook rules) |

## Quick start (developers)

You need Node.js 20 or newer and access to a Supabase project that has been set up as described in [docs/setup.md](docs/setup.md).

```bash
npm install
cp .env.example .env.local   # then fill in the three values (see docs/setup.md)
npm run dev                  # http://localhost:3000 (customer) and http://localhost:3000/admin (owner)
```

Before pushing:

```bash
npm run lint    # type check + React hook rules
npm run build   # production build; must pass, Vercel runs the same build
```

## Documentation

| Document | For |
| --- | --- |
| [docs/setup.md](docs/setup.md) | Setting everything up from scratch, step by step (no coding needed) |
| [docs/database.md](docs/database.md) | Every SQL file, the order to run them, which delete data and which must never be re-run |
| [docs/architecture.md](docs/architecture.md) | How the parts connect, what runs where, and who can do what (security model) |
| [docs/operations.md](docs/operations.md) | Testing on the dev link, going live, rolling back, and fixing common problems |

## Project layout

```
app/                     Pages
  page.tsx               Menu (customer home)
  cart/, checkout/       Cart and checkout
  order/[id]/            Order status page
  admin/                 Owner screen: login, orders, menu, offers, sales, settings, print/[id]
  error.tsx, global-error.tsx   "Something went wrong. Please refresh." pages
components/              Shared pieces (menu card, bill lines, error boundary, ...)
  admin/                 Owner shell (sign-in check, chime, alerts, tabs), dish and offer forms
lib/                     Logic
  supabase.ts            Supabase client (reads the environment variables)
  menu.tsx, menu-db.ts   Loads dishes and offers
  cart.tsx, pricing.ts   Cart and price rules (pricing.ts must match place_order in SQL)
  orders.ts, customer.ts Placing orders, saved orders and saved address
  storage.ts             Everything saved on the device (versioned and checked)
  settings.ts            Delivery fee and minimum order
  admin/                 Owner queries, IST time helpers, chime, push alerts, sales
data/menu.ts             Category list and order, card colours (the original static menu)
public/sw.js             Service worker: notifications only (never caches pages)
public/admin.webmanifest Makes /admin installable as "Xu Kitchen"
supabase/*.sql           Database setup, run in order (see docs/database.md)
supabase/functions/notify-new-order/   Edge Function that sends the notifications
```

## Rules of thumb for changes

- **Never put keys, passwords, emails or customer data in this repository.** It is public. Keys go in Vercel environment variables and Supabase secrets only.
- **Prices:** the price and offer rules live in two places that must agree: `place_order` (SQL) and `lib/pricing.ts`. The server refuses an order whose total differs from what the customer saw.
- **Saved data:** anything saved on the device goes through `lib/storage.ts`. If you change what an item holds, change the version in its key.
- **Database changes:** add a new numbered SQL file (`07_…sql`). Don't edit files that have already been run; see [docs/database.md](docs/database.md).
- **Deploying:** push to `dev`, test on the preview link, then go live with a pull request into `main` ([docs/operations.md](docs/operations.md)).
