# Xu Noodles — Menu & Ordering App

A mobile-first menu and ordering site for **Xu Noodles** (Indo-Chinese), built with Next.js (App Router), TypeScript and Tailwind CSS.

Customers can browse the menu, filter veg-only, search dishes, pick Half/Full portions, build a cart (saved in the browser), add cooking instructions and place a Dine-in or Takeaway order. There is no login, payment or backend yet. An order shows a confirmation screen with an order number.

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

`category` must be one of the category ids below (e.g. `soups`). Dishes with both `price_half` and `price_full` get a Half/Full choice. Set `sold_out_until` to a future time to show a dish as sold out until then.

> The cart and checkout still read prices from `data/menu.ts` for now.

## Editing the menu (data/menu.ts)

The category list and order, card colours and GST live in [`data/menu.ts`](data/menu.ts). The dish list in that file is still used by the cart and checkout.

### Change a price

Find the dish and change `price`:

```ts
{
  id: "veg-manchow-soup",
  name: "Veg Manchow Soup",
  price: 129,          // ← whole rupees, before GST
  ...
}
```

For dishes with Half/Full portions, change the numbers in `portions` instead (and keep `price` equal to the Half price, since it's used as a fallback):

```ts
price: 139,
portions: halfFull(139, 199),   // Half ₹139, Full ₹199
```

### Add a dish

Copy an existing item inside the `menu` list, paste it below, and edit the fields:

| Field         | What it does                                                                |
| ------------- | --------------------------------------------------------------------------- |
| `id`          | Unique, lowercase, no spaces (e.g. `"paneer-chilli-garlic"`). Don't reuse one. |
| `name`        | Dish name shown on the menu                                                 |
| `description` | One short line                                                               |
| `category`    | One of the category `id`s (see below)                                       |
| `price`       | Price in ₹                                                                  |
| `veg`         | `true` = green veg mark, `false` = non-veg mark                             |
| `spice`       | `0` none, `1` mild, `2` medium, `3` hot (shown as 🌶️)                        |
| `bestseller`  | Optional. `true` shows the ★ Bestseller badge                               |
| `portions`    | Optional. `halfFull(half, full)` makes customers choose Half or Full        |
| `emoji`       | The food emoji on the card's picture                                        |
| `color`       | Card picture background, as Tailwind gradient colours, e.g. `"from-red-600 to-red-900"` |

### Remove a dish

Delete its whole `{ ... },` block. Customers who had it in their cart will simply have it dropped.

### Add, rename or reorder categories

Edit the `categories` list near the top of the file. The order there is the order of the tabs and sections.

To add a new category:

1. Add its id to the `CategoryId` type, e.g. `| "chopsuey"`.
2. Add `{ id: "chopsuey", name: "Chopsuey", emoji: "🥢" }` to `categories`.
3. Set `category: "chopsuey"` on the dishes that belong to it.

Empty categories are hidden automatically.

### GST

The tax rate is `GST_RATE` at the bottom of `data/menu.ts` (currently 5%).

## Project layout

```
app/page.tsx            Menu page (tabs, search, veg filter)
app/cart/page.tsx       Cart, cooking instructions, bill summary
app/checkout/page.tsx   Checkout form and order confirmation
components/             Header, logo, item card, portion picker, cart bar
lib/cart.tsx            Cart state (saved to localStorage)
data/menu.ts            ← the menu
```
