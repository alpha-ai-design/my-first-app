import { FunctionsHttpError } from "@supabase/supabase-js";
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

export type PushState =
  | "checking"
  | "not-configured" // NEXT_PUBLIC_VAPID_PUBLIC_KEY missing
  | "ios-add-to-home" // iPhone/iPad in Safari: only works from the home-screen app
  | "unsupported"
  | "blocked" // permission denied
  | "off"
  | "on";

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

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

// Saves the subscription; an already-saved one (same endpoint) counts as success.
async function save(sub: PushSubscription) {
  const json = sub.toJSON();
  const { error } = await supabase!.from("push_subscriptions").insert({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
  if (error && error.code !== "23505") throw error;
}

export async function getPushState(): Promise<PushState> {
  if (!PUBLIC_KEY) return "not-configured";
  if (!supported()) return isIOS() && !isStandalone() ? "ios-add-to-home" : "unsupported";
  if (isIOS() && !isStandalone()) return "ios-add-to-home";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const sub = await currentSubscription();
  if (!sub || !sameKey(sub.options.applicationServerKey, keyBytes(PUBLIC_KEY))) return "off";
  // Re-save quietly in case the server removed it (e.g. after a reinstall).
  save(sub).catch((err) => console.error("Could not re-save push subscription", err));
  return "on";
}

export async function turnOnNotifications(): Promise<PushState> {
  // Ask first, straight from the tap: iPhone only allows the prompt during a user gesture.
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";

  if (!navigator.onLine) throw new PushError("offline");

  let reg: ServiceWorkerRegistration | undefined;
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  } catch (err) {
    throw new PushError("unsupported", err);
  }
  if (!reg) throw new PushError("unsupported", "service worker did not register");
  await waitUntilActive(reg);

  let key: Uint8Array<ArrayBuffer>;
  try {
    key = keyBytes(PUBLIC_KEY);
    if (key.length !== 65 || key[0] !== 4) throw new Error(`public key has ${key.length} bytes`);
  } catch (err) {
    throw new PushError("setup", err); // NEXT_PUBLIC_VAPID_PUBLIC_KEY isn't a valid public key
  }

  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe(); // made with an old key
    sub = null;
  }
  try {
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") throw new PushError("blocked", err);
    if (!navigator.onLine) throw new PushError("offline", err);
    throw new PushError("setup", err); // bad key, or the browser's push service refused it
  }
  try {
    await save(sub);
  } catch (err) {
    throw new PushError("setup", err); // e.g. push_subscriptions table missing (05_push.sql not run)
  }
  return "on";
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
  if (!sub) return "Notifications are off on this phone. Turn them on first.";
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
    if (expired) return "This phone's registration has expired. Tap “Turn on order notifications” again.";
    if (status === 401) return "Your sign-in has expired. Log out and sign in again, then try the test.";
  }
  // Function not deployed, secrets missing or wrong, or another server-side problem.
  return PUSH_MESSAGES.setup;
}
