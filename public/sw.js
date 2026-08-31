const SW_VERSION = "gymflow-push-v10";
const CACHE_NAME = "gymflow-shell-v10";
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/infytter-logo.svg",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url)));

  // Vite genera nombres con hash. Descubrimos los assets desde el HTML para
  // que una PC que ya abrió GymFlow pueda volver a arrancar sin Internet.
  try {
    const response = await fetch("/", { cache: "no-store" });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put("/", response);
    const urls = new Set();
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const value = match[1];
      if (!value || value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) continue;
      const url = new URL(value, self.location.origin);
      if (url.origin === self.location.origin && (url.pathname.startsWith("/assets/") || /\.(?:js|css|woff2?|png|svg)$/i.test(url.pathname))) urls.add(url.pathname + url.search);
    }
    await Promise.allSettled([...urls].map((url) => cache.add(url)));
  } catch {
    // La instalación no falla si algún asset secundario no está disponible.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await cacheAppShell();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("gymflow-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match("/");
        if (cached) return cached;
        throw new Error("GymFlow todavía no tiene una copia offline en esta PC.");
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
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
