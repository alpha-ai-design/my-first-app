# Setting up from scratch

This guide sets up the whole system on new accounts, without writing code. It takes about an hour. Keep a password manager open: you'll create a few passwords and keys along the way. **Never paste keys or passwords into GitHub, chat messages or documents.**

You need:

- a **GitHub** account with this repository (or a copy of it),
- a **Supabase** account (free plan is enough to start),
- a **Vercel** account (free plan is enough to start), signed in with GitHub,
- the owner's phone (Android with Chrome, or iPhone with iOS 16.4 or newer).

---

## 1. Create the Supabase project

1. In Supabase, click **New project**.
2. **Name:** for example `xu-noodles`.
3. **Database password:** let Supabase generate one and **save it in your password manager**. You rarely need it, but it can't be recovered.
4. **Region:** choose **South Asia (Mumbai)**, the closest to Greater Noida, so the app is fast.
5. Click **Create new project** and wait a minute or two.

## 2. Build the database

Open **SQL Editor** in the left menu. For each step below: **New query** → paste the file's contents (from GitHub, open the file → **Copy raw file**) → **Run** → check it says "Success".

1. **Starting tables:** copy the SQL block under "0. Starting tables" in [database.md](database.md). (Only for a new project.)
2. `supabase/seed.sql`: the menu.
3. `supabase/updates.sql`: delivery-only setup. ⚠️ This deletes all orders; on a new project there are none, so it's fine **now**, but never run it again later.
4. `supabase/02_free_text_society.sql`
5. `supabase/03_owner_orders.sql`. If it reports that `pg_cron` isn't available, go to **Database → Extensions**, turn on **pg_cron**, and run the file again.
6. `supabase/04_menu.sql`
7. `supabase/05_push.sql`
8. `supabase/06_offers_and_sales.sql`

Run them **once each, in this order**. [database.md](database.md) explains each file and which ones must never be re-run.

Then set the delivery fee and minimum order: **Table Editor → `restaurant_settings`** → edit the single row (`delivery_fee`, `min_order` in rupees; 0 means none).

## 3. Owner login

1. **Authentication → Sign In / Providers** (on older dashboards: Authentication → Providers / Settings).
   - Turn **off** "Allow new users to sign up". This matters: anyone who can sign in can see customer addresses and phone numbers.
   - Keep the **Email** provider enabled.
2. **Authentication → Users → Add user → Create new user**:
   - enter the owner's email and a strong password,
   - tick **Auto Confirm User**,
   - save. Give the owner the password privately; they can change it later in the app under **Settings → Change password**.

## 4. Notification keys (VAPID)

Order alerts need a pair of keys: a **public** key and a **private** key. Create them once and keep them in your password manager.

Ask a developer to run this on their computer, or run it yourself if Node.js is installed:

```bash
npx web-push generate-vapid-keys
```

It prints a **Public Key** (about 87 characters, starting with `B`) and a **Private Key** (about 43 characters). The private key must only ever go into Supabase secrets (step 6).

## 5. Website on Vercel

1. In Vercel: **Add New… → Project** → import this GitHub repository. Framework: **Next.js** (detected automatically).
2. Before deploying, open **Environment Variables** and add these three. Tick **Production**, **Preview** and **Development** for each:

   | Name | Where to find the value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → **API** → Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → **API Keys** → publishable key (or the "anon public" key on older projects) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | The **public** key from step 4 |

   These three are public by design. **Never** add the VAPID private key or the Supabase service role / secret key to Vercel.
3. Click **Deploy**. When it finishes, open the site: the menu should appear.
4. If you change an environment variable later, go to **Deployments → ⋯ → Redeploy**. The values are built into the site, so they only take effect after a new build.

## 6. Supabase secrets for notifications

Supabase → **Edge Functions → Secrets** (sometimes under Project Settings → Edge Functions). Add:

| Name | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | the public key from step 4 (the same one as in Vercel) |
| `VAPID_PRIVATE_KEY` | the private key from step 4 |
| `VAPID_SUBJECT` | `mailto:` followed by the restaurant's contact email address, with no space |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions automatically; don't add them.

## 7. Edge Function `notify-new-order`

1. Supabase → **Edge Functions → Deploy a new function → Via Editor**.
2. Name it exactly `notify-new-order`.
3. Delete the example code and paste the whole of `supabase/functions/notify-new-order/index.ts` from GitHub.
4. Click **Deploy**.
5. **Verify JWT** (in the function's settings): it can stay on. If the project's publishable key starts with `sb_publishable_`, turn it **off**: the service worker uses that key when a phone's subscription is renewed while the app is closed, and such keys aren't JWTs. Turning it off is safe because the function checks every request itself ([architecture.md](architecture.md#security-model)).

Whenever this file changes in GitHub, paste the new version and deploy again.

## 8. Database Webhook (sends alerts on new orders)

1. Supabase → **Database → Webhooks** (on newer dashboards: **Integrations → Database Webhooks**). Click **Enable webhooks** if asked.
2. **Create a new hook**:
   - Name: `new_order_push`
   - Table: `orders`
   - Events: **Insert** only
   - Type: **Supabase Edge Functions**, function `notify-new-order`, method **POST**
   - HTTP Headers: click **Add auth header with service key**
3. **Create webhook**.

## 9. The owner's phone

**Android (Chrome)**
1. Open `https://<your site>/admin` and sign in. The Orders screen opens.
2. Chrome menu **⋮ → Install app** (or **Add to Home screen**), then open **Xu Kitchen** from the home screen.
3. When the blue banner says **Turn on alerts for new orders**, tap **Turn on alerts** → **Allow**. The header then shows **🔔 Alerts on**.
4. **Settings → Send test notification**: a test alert should arrive within seconds.
5. In the phone's battery settings, allow Chrome / Xu Kitchen to run in the background, so alerts aren't delayed.

**iPhone (iOS 16.4 or newer)**
1. Open `https://<your site>/admin` in **Safari**.
2. **Share → Add to Home Screen → Add.**
3. Open **Xu Kitchen** from the home screen and sign in. The home-screen app has its own sign-in.
4. Tap **Turn on alerts** → **Allow**, then **Settings → Send test notification**.

Sound: browsers only allow sound after the screen has been touched. If the yellow banner **Tap anywhere to turn on order sound** shows, tap once anywhere.

## 10. Final check

- [ ] The menu shows on the home page.
- [ ] A test order from another phone appears on the owner's Orders screen with a chime.
- [ ] The owner's phone gets "🔔 New order #N · Collect ₹X", even with the app closed.
- [ ] Accepting the order updates the customer's status page within a few seconds.
- [ ] An order left alone is rejected automatically after 8 minutes.
- [ ] Sign-ups are off (Authentication settings).

To make test orders disappear from sales, reject or cancel them; there is no delete button by design.
