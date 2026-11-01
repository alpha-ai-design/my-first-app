// Xu Kitchen service worker: shows new-order push notifications and opens the
// owner screen when one is tapped. Registered with scope /admin.
//
// It deliberately has NO "fetch" handler, so it never caches or serves JavaScript, CSS or pages:
// every file always comes fresh from the network. When a new version activates it deletes any
// caches left by earlier versions.

const SW_VERSION = "2026-11-01b"; // change this to force phones to pick up a new service worker

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

// Lets a page ask which version is running (used by tests).
self.addEventListener("message", (event) => {
  if (event.data === "version" && event.ports[0]) event.ports[0].postMessage(SW_VERSION);
});

// Public settings passed in the worker's URL by the owner screen (see lib/admin/push.ts).
const CONFIG = (() => {
  const q = new URL(self.location.href).searchParams;
  return { key: q.get("key") || "", fn: q.get("fn") || "", apikey: q.get("apikey") || "" };
})();

function keyBytes(base64url) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// The browser replaced (or dropped) this phone's push subscription. Get the new one saved so
// order alerts keep arriving:
//   1. any open owner screen re-checks and saves it (signed in), and
//   2. the notify-new-order function swaps the old address for the new one, which works even
//      when the app is closed (it only accepts the swap for an address it already has).
async function renewSubscription(oldSub, newSub) {
  let sub = newSub;
  if (!sub) {
    const key = (oldSub && oldSub.options && oldSub.options.applicationServerKey) || (CONFIG.key && keyBytes(CONFIG.key));
    if (!key) return;
    sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  windows.forEach((w) => w.postMessage({ type: "subscription-changed" }));
  if (CONFIG.fn && oldSub && oldSub.endpoint && oldSub.endpoint !== sub.endpoint) {
    const json = sub.toJSON();
    await fetch(CONFIG.fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CONFIG.apikey, Authorization: `Bearer ${CONFIG.apikey}` },
      body: JSON.stringify({ type: "renew", old_endpoint: oldSub.endpoint, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
    }).catch(() => {
      // Offline: the owner screen saves it the next time it opens.
    });
  }
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(renewSubscription(event.oldSubscription, event.newSubscription));
});
self.__renewSubscription = renewSubscription; // for tests

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "🔔 New order";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Open Xu Kitchen to see it.",
      tag: data.tag || "xu-kitchen", // one notification per order
      renotify: true, // still buzz if a notification with the same tag is replaced
      requireInteraction: true, // stay on screen until dismissed (where supported)
      icon: "/icons/xu-kitchen-192.png",
      badge: "/icons/xu-kitchen-badge-96.png",
      vibrate: [300, 150, 300, 150, 600],
      data: { url: data.url || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/admin", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse an open owner screen if there is one.
      const open = windows.find((w) => new URL(w.url).pathname.startsWith("/admin"));
      if (open) return open.focus();
      await self.clients.openWindow(url);
    })(),
  );
});
