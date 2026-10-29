// Xu Kitchen service worker: shows new-order push notifications and opens the
// owner screen when one is tapped. Registered with scope /admin.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
