# Operations

How changes get from the code to customers, how to undo a bad release, and what to do when something goes wrong.

## Branches and links

| Branch | Vercel environment | Who sees it |
| --- | --- | --- |
| `dev` | **Preview**: its own link, updated on every push to `dev` | You, for testing |
| `main` | **Production**: the real website | Customers and the owner |

Never push straight to `main`. Work goes to `dev`, gets tested on the preview link, then reaches `main` through a pull request.

**Finding the dev link:** Vercel → your project → **Deployments** → filter by branch `dev` → open the newest one → **Visit**. The branch link stays the same between pushes; it looks like `<project>-git-dev-<team>.vercel.app`. If Vercel asks you to log in, that's Vercel's Deployment Protection for previews (Settings → Deployment Protection).

> ⚠️ Preview and production normally use the **same Supabase project** (the same environment variable values). Orders placed while testing on the dev link are **real orders** in the owner's screen and in Sales. Test orders: reject or cancel them afterwards. SQL files run in Supabase affect the live site **immediately**, not just the dev link.

## Testing on the dev link

After every push to `dev`, wait for the Vercel deployment to show **Ready**, then on a phone:

**Customer side**
- [ ] The home page shows the menu, categories, Veg only filter and search.
- [ ] Offers show struck-through prices / the order offer banner (if any offers are active).
- [ ] Add dishes (including a Half / Full one) → Cart shows subtotal, discount, GST, delivery fee and total.
- [ ] Checkout → **Place order** → the status page shows "Waiting for the restaurant to confirm...".

**Owner side** (`/admin`)
- [ ] Opens straight on Orders; the test order appears with a chime (tap once if the sound banner shows).
- [ ] Choose a time → **Accept** → the customer's status page shows "Accepted! Arriving in about X minutes."
- [ ] **Print bill** opens the receipt.
- [ ] Menu, Offers and Sales tabs load.
- [ ] Header shows **🔔 Alerts on**; Settings → **Send test notification** arrives.

**Afterwards:** cancel or reject the test order.

Developers can also run `npm run lint` and `npm run build` before pushing; Vercel runs the same build.

## Going live (pull request from `dev` to `main`)

1. **Database first.** If the change includes a new SQL file, run it in the Supabase SQL Editor **before** merging (see [database.md](database.md)). Write SQL changes so that the current live site keeps working with them.
2. On GitHub: **Pull requests → New pull request** → base: `main`, compare: `dev` → **Create pull request**. Describe what changes for customers and for the owner.
3. Check the pull request: the Vercel check is green, and the description matches what you tested.
4. **Merge pull request.** Vercel builds `main` and switches the live site over automatically (a few minutes).
5. Open the live site and repeat the quick checks above (one real test order, then cancel it).
6. **The first time only:** make sure the three environment variables are also set for **Production** in Vercel (Settings → Environment Variables), and that the Edge Function, its secrets and the Database Webhook exist ([setup.md](setup.md)).

## Rolling back the website

If a release breaks the live site:

1. Vercel → your project → **Deployments**.
2. Find the last **Production** deployment that worked (it has a "Production" label and an older date).
3. **⋯ → Instant Rollback** (on some plans: **Promote to Production**). The live site switches back within seconds; no rebuild needed.
4. Fix the problem on `dev`, test, and go live again with a new pull request. Merging to `main` makes the newest deployment live again.

**Database changes are not rolled back.** Vercel only switches website files; anything run in the Supabase SQL Editor stays.

> ⚠️ Don't roll the website back to a version from **before the offers update** (before `06_offers_and_sales.sql`) while the database has that file applied. Older websites don't send the "expected total", so `place_order` refuses every order with "Prices changed…". In that situation roll back only to a deployment that includes offers, or fix forward.

The Edge Function has no rollback button. To undo a function change, paste the previous version of `supabase/functions/notify-new-order/index.ts` (from the GitHub history) and deploy.

## Troubleshooting

### Order alerts (notifications) not arriving

Work down this list; most problems are found in the first three steps.

1. **Look at the owner screen's header.**
   - **🔔 Alerts on** → this phone is registered; go to step 3.
   - **Blue banner "Turn on alerts for new orders"** → tap **Turn on alerts** → **Allow**.
   - **Red banner "Order alerts are off"** → it says exactly what to do:
     - **Android Chrome:** tap the icon left of the address → Permissions / Site settings → Notifications → **Allow**. Or phone **Settings → Apps → Chrome (or Xu Kitchen) → Notifications → Allow**.
     - **iPhone:** **Settings → Notifications → Xu Kitchen → Allow Notifications**. On iPhone, alerts only work in the home-screen app (Share → Add to Home Screen), not in Safari.

     Then tap **I've allowed it** or reopen the app.
2. **Settings → Send test notification.**
   - **Arrives** → push works; the problem is the new-order trigger (step 4).
   - **"Notifications aren't set up correctly…"** → the Edge Function isn't deployed, or its secrets are missing or wrong (step 5).
   - **"…registration had expired…"** → wait a few seconds and test again; the app renews it automatically.
3. **Phone settings.** Battery saver or "optimise battery" can delay alerts on Android. Allow background activity for Chrome / Xu Kitchen. Do Not Disturb / Focus mode silences them.
4. **The trigger.** Supabase → Database → Webhooks: `new_order_push` exists, on table `orders`, event **Insert**, function `notify-new-order`, with the auth header. Supabase → **Edge Functions → notify-new-order → Logs / Invocations** should show a call for every new order.
5. **The function.**
   - **Secrets:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` must all be set. `VAPID_PUBLIC_KEY` must be **identical** to `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in Vercel.
   - **Changed keys:** after changing either key, redeploy the site. Every phone re-registers automatically the next time `/admin` opens.
   - **Logs:** errors are listed under Edge Functions → Logs.
6. **The database.** Table Editor → `push_subscriptions` should have one row per phone with alerts on. If it's empty, check that `05_push.sql` was run.

### The site shows "Something went wrong. Please refresh." or a blank page after an update

1. **Refresh once.** A phone may still have the previous version's page open.
2. **Is it one section or the whole page?** Each section has its own error guard, so a single broken part shows the message in place while the rest keeps working.
3. **Does it happen in a private / incognito window?** If not, it's old data or an old copy on that phone; see the next section.
4. **Did the build succeed?** Vercel → Deployments → the newest deployment → **Build Logs**.
5. **Get the details:** open the site on a computer → right-click → Inspect → **Console**. Lines starting with `Error in …` name the broken section. Share that line with whoever maintains the app.
6. **Still broken for everyone?** Roll back (above), then fix on `dev`.

### Old data saved on a phone

The app keeps the cart, the customer's address, recent orders and (on the owner's phone) the alert registration in the browser. Every saved item is versioned and checked when read. Anything old, broken or pointing to orders that no longer exist is thrown away automatically, so this shouldn't need manual work.

If a single phone still misbehaves while a private window works fine, clear that site's data:

- **Android Chrome:** open the site → tap the icon left of the address → **Site settings** → **Clear & reset** (or Delete data).
- **iPhone Safari:** **Settings → Safari → Advanced → Website Data** → find the site → swipe to delete.
- **iPhone home-screen app:** delete the app from the home screen and add it again.

Clearing data signs the owner out, empties the cart and forgets the saved address. On the owner's phone, sign in again; alerts re-register automatically if permission is still allowed.

### Other common problems

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Customer sees "Prices changed because an offer just ended…" | An offer started or ended while they were checking out | Nothing to fix: the cart is kept with the new prices; they place the order again |
| Every order fails with "Prices changed…" | The website is older than the database's `place_order`, or the prices in `lib/pricing.ts` and `place_order` disagree | Make sure the live site includes the offers update; never re-run an older SQL file ([database.md](database.md)) |
| Menu doesn't load ("Sorry, we couldn't load the menu") | Wrong or missing environment variables, or the Supabase project is paused | Check the three Vercel variables and redeploy; Supabase free projects pause after inactivity (restore from the dashboard) |
| Orders never get auto-rejected | `pg_cron` isn't enabled, or `03_owner_orders.sql` didn't finish | Database → Extensions → enable `pg_cron`, then re-run `03_owner_orders.sql` (safe) |
| New orders only appear after up to 30 seconds | Realtime connection dropped (the backup refresh takes over) | Check `03_owner_orders.sql` was run; reopen the app |
| Owner can't sign in | Wrong password, or the user isn't confirmed | Authentication → Users: check the user, use **Send password recovery** or set a new password |
| Sales tab: "Can't load sales" | `06_offers_and_sales.sql` not run | Run it (safe to re-run) |
| No sound on the owner's phone | Sound locked until the screen is touched, or the phone is on silent | Tap once anywhere (the yellow banner disappears); check the phone's media volume |
| Screen turns off on the Orders tab | Browser doesn't support keeping the screen awake | Set the phone's screen timeout longer while working |
