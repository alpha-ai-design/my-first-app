import { FunctionsHttpError } from "@supabase/supabase-js";
import { isObject, isText, readItem, writeItem } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

// Owner-phone push notifications (standard Web Push). The service worker is public/sw.js.

const SW_URL = "/sw.js";
const SW_SCOPE = "/admin";
// Pasted keys often pick up spaces, quotes or line breaks; none of those belong in a base64url key.
const PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").replace(/[\s"'`]/g, "");

// What the owner sees when something goes wrong.
export const PUSH_MESSAGES = {
  blocked: "Notifications are blocked. Tap the lock icon next to the address, then Notifications, then Allow.",
  blockedIOS: "Notifications are blocked. Open the iPhone Settings app → Notifications → Xu Kitchen → turn on Allow Notifications.",
  unsupported: "This browser can't receive notifications. Use Chrome, or on iPhone add Xu Kitchen to your home screen.",
  setup: "Notifications aren't set up correctly. Please contact whoever set up this app.",
  offline: "You're offline. Connect to the internet and try again.",
} as const;

export class PushError extends Error {
  constructor(public readonly kind: keyof typeof PUSH_MESSAGES, cause?: unknown) {
    super(PUSH_MESSAGES[kind]);
    if (cause) console.error("Push notifications:", kind, cause);
  }
}

// Order-alert status shown in the owner screen's header and banners.
export type AlertStatus =
  | { kind: "checking" }
  | { kind: "on" } // permission granted and a valid subscription is saved for this device
  | { kind: "ask" } // permission never asked: offer to turn alerts on
  | { kind: "off"; reason: "denied" | "ios-add-to-home" | "unsupported" | "setup" | "offline"; message: string };

export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null, b: Uint8Array) => !!a && a.byteLength === b.length && new Uint8Array(a).every((v, i) => v === b[i]);

const off = (reason: Extract<AlertStatus, { kind: "off" }>["reason"]): AlertStatus => {
  const message = {
    denied: isIOS() ? PUSH_MESSAGES.blockedIOS : PUSH_MESSAGES.blocked,
    "ios-add-to-home": "On iPhone, alerts only work from the home-screen app. Tap Share, then Add to Home Screen, then open Xu Kitchen from your home screen.",
    unsupported: PUSH_MESSAGES.unsupported,
    setup: PUSH_MESSAGES.setup,
    offline: "You're offline, so alerts couldn't be checked. They'll be checked again when you're back online.",
  }[reason];
  return { kind: "off", reason, message };
};

// The service worker gets what it needs to save a renewed subscription by itself
// (pushsubscriptionchange) through its URL. These are public values: the push key and the
// Supabase project's publishable key and function address.
function workerUrl(): string {
  const params = new URLSearchParams({
    key: PUBLIC_KEY,
    fn: `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/functions/v1/notify-new-order`,
    apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  });
  return `${SW_URL}?${params}`;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(workerUrl(), { scope: SW_SCOPE });
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (!reg) throw new PushError("unsupported", "service worker did not register");
  await waitUntilActive(reg);
  return reg;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

// The endpoint this device last saved, so a replaced one can be removed from push_subscriptions.
const SAVED_KEY = "xu-kitchen-push-v1";
const lastSavedEndpoint = () => readItem(SAVED_KEY, (v) => (isObject(v) && isText(v.endpoint, 2000) ? v.endpoint : null));

// Saves the subscription (an already-saved one counts as success) and removes the one it replaced.
async function save(sub: PushSubscription) {
  const json = sub.toJSON();
  const { error } = await supabase!.from("push_subscriptions").insert({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
  if (error && error.code !== "23505") throw error;
  const previous = lastSavedEndpoint();
  if (previous && previous !== json.endpoint) {
    const { error: delError } = await supabase!.from("push_subscriptions").delete().eq("endpoint", previous);
    if (delError) console.error("Could not remove the old subscription", delError);
  }
  writeItem(SAVED_KEY, { endpoint: json.endpoint });
}

// Expiring within a day counts as expired: renew it now while the owner screen is open.
const expiresSoon = (sub: PushSubscription) => sub.expirationTime !== null && sub.expirationTime < Date.now() + 24 * 3600_000;

// Runs silently every time the owner screen opens: never shows a permission prompt.
// If alerts are allowed, makes sure this device has a valid subscription saved, renewing it if it is
// missing, expired or made with an old key.
export async function ensureAlerts(): Promise<AlertStatus> {
  if (!PUBLIC_KEY) return off("setup");
  if (isIOS() && !isStandalone()) return off("ios-add-to-home");
  if (!supported()) return off("unsupported");
  if (Notification.permission === "denied") return off("denied");
  if (Notification.permission !== "granted") return { kind: "ask" };

  let key: Uint8Array<ArrayBuffer>;
  try {
    key = keyBytes(PUBLIC_KEY);
    if (key.length !== 65 || key[0] !== 4) throw new Error(`public key has ${key.length} bytes`);
  } catch (err) {
    console.error("Push notifications: bad public key", err);
    return off("setup");
  }

  let reg: ServiceWorkerRegistration;
  try {
    reg = await registration();
  } catch (err) {
    console.error("Push notifications: service worker", err);
    return off("unsupported");
  }

  let sub = await reg.pushManager.getSubscription();
  if (sub && (!sameKey(sub.options.applicationServerKey, key) || expiresSoon(sub))) {
    await sub.unsubscribe().catch(() => {}); // made with an old key, or about to expire
    sub = null;
  }
  try {
    // Permission is already granted, so this never shows a prompt.
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  } catch (err) {
    console.error("Push notifications: subscribe", err);
    if (err instanceof DOMException && err.name === "NotAllowedError") return off("denied");
    return navigator.onLine ? off("setup") : off("offline");
  }
  try {
    await save(sub);
  } catch (err) {
    console.error("Push notifications: save", err);
    return navigator.onLine ? off("setup") : off("offline"); // e.g. push_subscriptions table missing
  }
  return { kind: "on" };
}

// From a tap on "Turn on alerts": asks for permission (iPhone only allows this during a tap), then
// sets everything up.
export async function enableAlerts(): Promise<AlertStatus> {
  if (!supported()) return ensureAlerts();
  await Notification.requestPermission();
  return ensureAlerts();
}

function waitUntilActive(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return Promise.resolve();
  const worker = reg.installing ?? reg.waiting;
  return new Promise((resolve) => {
    worker?.addEventListener("statechange", () => worker.state === "activated" && resolve());
    setTimeout(resolve, 5000); // don't hang forever
  });
}

// Asks the notify-new-order Edge Function to push a test to this phone. Returns an error message, or null.
export async function sendTestNotification(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return "Alerts aren't set up on this phone yet. Turn them on first.";
  if (!navigator.onLine) return PUSH_MESSAGES.offline;
  const { error } = await supabase!.functions.invoke("notify-new-order", { body: { type: "test", endpoint: sub.endpoint } });
  if (!error) return null;
  console.error("Test notification failed", error);
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    // Our function answers 404 "isn't registered" / 410 for an expired phone; a 404 without that
    // message means the function itself isn't deployed.
    const body = await error.context.json().catch(() => null);
    const expired = status === 410 || (status === 404 && /registered/i.test(body?.error ?? ""));
    if (expired) return "This phone's alert registration had expired and is being renewed. Wait a few seconds and send the test again.";
    if (status === 401) return "Your sign-in has expired. Log out and sign in again, then try the test.";
  }
  // Function not deployed, secrets missing or wrong, or another server-side problem.
  return PUSH_MESSAGES.setup;
}
