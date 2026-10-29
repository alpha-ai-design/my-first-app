// Xu Kitchen: push notifications for the owner.
//
// One function, two jobs:
//   1. Database Webhook on INSERT into orders → "🔔 New order #12 · Collect ₹457" to every saved device.
//   2. { type: "test", endpoint } from the owner's Settings → a test notification to that one device.
//
// Secrets (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// Web Push library: @negrel/webpush (Web Crypto only, built for Deno; RFC 8291 encryption + RFC 8292 VAPID).

import * as webpush from "jsr:@negrel/webpush@0.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Subscription = { endpoint: string; p256dh: string; auth: string };
type Payload = { title: string; body: string; tag: string; url: string };

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

// VAPID keys are stored in the standard base64url form (65-byte public key, 32-byte private key);
// the library wants them as JSON Web Keys.
async function loadVapidKeys(): Promise<CryptoKeyPair> {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
  const priv = Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
  if (!pub || !priv) throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets are missing");
  const raw = Uint8Array.from(atob(pub.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  if (raw.length !== 65 || raw[0] !== 4) throw new Error("VAPID_PUBLIC_KEY is not a valid P-256 public key");
  const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const publicKey = { kty: "EC", crv: "P-256", x: b64url(raw.slice(1, 33)), y: b64url(raw.slice(33, 65)), ext: true };
  return webpush.importVapidKeys({ publicKey, privateKey: { ...publicKey, d: priv } });
}

let vapidKeys: Promise<CryptoKeyPair> | null = null;

// Sends one notification. Returns "gone" when the push service says the subscription no longer exists.
async function send(sub: Subscription, payload: Payload): Promise<"sent" | "gone"> {
  vapidKeys ??= loadVapidKeys();
  // A fresh application server (and so a fresh encryption key pair) for every message, as RFC 8291 expects.
  const server = await webpush.ApplicationServer.new({
    contactInformation: Deno.env.get("VAPID_SUBJECT") ?? "mailto:owner@example.com",
    vapidKeys: await vapidKeys,
  });
  try {
    await server
      .subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
      // Orders are auto-rejected after 8 minutes, so an older alert is useless.
      .pushTextMessage(JSON.stringify(payload), { urgency: webpush.Urgency.High, ttl: 15 * 60 });
    return "sent";
  } catch (err) {
    if (err instanceof webpush.PushMessageError && [404, 410].includes(err.response.status)) return "gone";
    throw err;
  }
}

// Sends to every subscription and deletes the ones that are no longer valid.
async function sendAll(subs: Subscription[], payload: Payload) {
  const results = await Promise.allSettled(subs.map((s) => send(s, payload)));
  const gone = subs.filter((_, i) => results[i].status === "fulfilled" && (results[i] as PromiseFulfilledResult<string>).value === "gone");
  const failed = results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason));
  if (gone.length) {
    const { error } = await db.from("push_subscriptions").delete().in("endpoint", gone.map((s) => s.endpoint));
    if (error) console.error("Could not remove old subscriptions", error);
  }
  if (failed.length) console.error("Some notifications failed", failed);
  return { sent: results.length - gone.length - failed.length, removed: gone.length, failed: failed.length };
}

// "Flat 1204 · Tower B · Gaur City 2", without doubling labels the customer already typed.
function address(o: { flat_number?: string | null; tower?: string | null; society?: string | null }) {
  const label = (prefix: string, v: string | null | undefined, already: RegExp) => {
    const t = v?.trim();
    return t ? (already.test(t) ? t : `${prefix} ${t}`) : null;
  };
  return [label("Flat", o.flat_number, /^flat\b/i), label("Tower", o.tower, /\b(tower|block)\b/i), o.society?.trim() || null]
    .filter(Boolean)
    .join(" · ");
}

const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected a JSON body" }, 400);
  }

  try {
    // 2. Test notification from the owner's screen: only for signed-in staff, only to their own device.
    if (body.type === "test") {
      const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      const { data: auth } = await db.auth.getUser(token);
      if (!auth?.user) return json({ error: "Sign in to the owner screen first" }, 401);

      const { data: sub, error } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").eq("endpoint", body.endpoint ?? "").maybeSingle();
      if (error) throw error;
      if (!sub) return json({ error: "This phone isn't registered. Tap “Turn on order notifications” again." }, 404);

      const result = await sendAll([sub], {
        title: "🔔 Test notification",
        body: "Order alerts are working on this phone.",
        tag: `test-${Date.now()}`,
        url: "/admin",
      });
      return json(result, result.sent ? 200 : 410);
    }

    // 1. Database Webhook: a new row in orders.
    if (body.type === "INSERT" && body.table === "orders" && body.record?.id) {
      // Read the order ourselves rather than trusting the request body, so only real,
      // just-placed orders ever produce an alert.
      const { data: order, error } = await db
        .from("orders")
        .select("id, order_number, total, flat_number, tower, society, status, created_at")
        .eq("id", body.record.id)
        .maybeSingle();
      if (error) throw error;
      const fresh = order && order.status === "pending" && Date.now() - new Date(order.created_at).getTime() < 15 * 60_000;
      if (!fresh) return json({ skipped: "not a new pending order" });

      const { data: subs, error: subsError } = await db.from("push_subscriptions").select("endpoint, p256dh, auth");
      if (subsError) throw subsError;
      if (!subs?.length) return json({ sent: 0, removed: 0, failed: 0, note: "no devices have notifications turned on" });

      return json(
        await sendAll(subs, {
          title: `🔔 New order #${order.order_number} · Collect ${rupees(Number(order.total))}`,
          body: address(order),
          tag: `order-${order.id}`, // one notification per order
          url: "/admin",
        }),
      );
    }

    return json({ error: "Unknown request" }, 400);
  } catch (err) {
    console.error("notify-new-order failed", err);
    return json({ error: "Something went wrong sending notifications" }, 500);
  }
});
