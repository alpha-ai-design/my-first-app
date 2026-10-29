import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Owner-phone push notifications (standard Web Push). The service worker is public/sw.js.

const SW_URL = "/sw.js";
const SW_SCOPE = "/admin";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

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

  await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (!reg) throw new Error("Service worker did not register");
  await waitUntilActive(reg);

  const key = keyBytes(PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe(); // made with an old key
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await save(sub);
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
  const { error } = await supabase!.functions.invoke("notify-new-order", { body: { type: "test", endpoint: sub.endpoint } });
  if (!error) return null;
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (error.context.status === 410) return "This phone's registration has expired. Tap “Turn on order notifications” again.";
    if (body?.error) return body.error;
  }
  console.error("Test notification failed", error);
  return "Couldn't send the test. Check the internet, and that the notify-new-order function is set up in Supabase.";
}
