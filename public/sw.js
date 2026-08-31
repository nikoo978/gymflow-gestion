const SW_VERSION = "gymflow-push-v8";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("gymflow-shell-")).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json?.() || {};
  } catch {
    payload = { body: event.data?.text?.() || "" };
  }

  const options = {
    body: payload.body || "Tenés una nueva notificación.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || payload.type || `infytter-${Date.now()}`,
    renotify: true,
    vibrate: [180, 100, 180],
    data: {
      url: payload.url || "/",
      type: payload.type || null,
      swVersion: SW_VERSION,
      ...(payload.data || {}),
    },
    actions: [{ action: "open", title: "Abrir" }],
  };

  event.waitUntil(self.registration.showNotification(payload.title || "Infytter Fitness", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("navigate" in client && client.url !== url) await client.navigate(url).catch(() => undefined);
      if ("focus" in client) return client.focus();
    }
    return self.clients.openWindow(url);
  })());
});
