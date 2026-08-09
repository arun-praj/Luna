/* Luna PWA worker. Keep this file dependency-free so it works offline. */
const STATIC_CACHE = "budget-static-v34";
const OFFLINE_SHELL = "/offline";
const CORE_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

async function cacheOfflineShell(cache) {
  const response = await fetch(OFFLINE_SHELL, { cache: "reload" });
  if (!response.ok) return;

  const html = await response.clone().text();
  await cache.put(OFFLINE_SHELL, response);

  // The offline route is a client-rendered page. Cache the route's own
  // Next.js bundles while online so the browser can hydrate it after the
  // connection disappears instead of staying on the server loading shell.
  const assets = [...html.matchAll(/(?:src|href)="([^\"]*(?:\/_next\/static\/|\/assets\/)[^\"]+)"/g)]
    .map((match) => match[1])
    .filter((asset, index, all) => all.indexOf(asset) === index);
  await Promise.allSettled(
    assets.map((asset) => cache.add(new URL(asset, self.location.origin).toString())),
  );

  // OfflineHome is a dynamic client entry and is referenced by the RSC
  // payload rather than a normal script tag in the shell HTML. Follow its
  // Vite manifest imports so offline navigation has every bundle it needs to
  // hydrate instead of stopping at the server loading screen.
  try {
    const manifestResponse = await fetch("/.vite/manifest.json", { cache: "reload" });
    if (!manifestResponse.ok) return;
    const manifest = await manifestResponse.json();
    const routeAssets = new Set(["/.vite/manifest.json"]);
    const visited = new Set();
    const visit = (key) => {
      if (visited.has(key)) return;
      visited.add(key);
      const entry = manifest[key];
      if (!entry) return;
      if (entry.file) routeAssets.add(`/${entry.file}`);
      for (const css of entry.css || []) routeAssets.add(`/${css}`);
      for (const importKey of entry.imports || []) visit(importKey);
      for (const dynamicImportKey of entry.dynamicImports || []) visit(dynamicImportKey);
    };
    visit("components/offline/offline-home.tsx");
    await Promise.allSettled(
      [...routeAssets].map((asset) => cache.add(new URL(asset, self.location.origin).toString())),
    );
  } catch {
    // The shell and its directly referenced assets are still useful if the
    // manifest is unavailable during an update.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await self.skipWaiting();
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset)));
      await cacheOfflineShell(cache).catch(() => undefined);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("budget-static-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache Vite's development module graph. Those URLs are generated
  // independently for React, React DOM, route modules, and HMR. Serving an old
  // optimized dependency beside a newly generated renderer creates multiple
  // React runtimes and causes invalid-hook errors across unrelated pages.
  const isLocalDevelopment = self.location.hostname === "localhost" ||
    self.location.hostname === "127.0.0.1" ||
    self.location.hostname === "::1";
  if (isLocalDevelopment) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname === OFFLINE_SHELL) {
            const copy = response.clone();
            void caches.open(STATIC_CACHE).then((cache) => cache.put(OFFLINE_SHELL, copy));
          }
          return response;
        })
        .catch(async () => {
          const shell = await caches.match(OFFLINE_SHELL);
          if (shell) {
            return url.pathname === OFFLINE_SHELL
              ? shell
              : Response.redirect(new URL(OFFLINE_SHELL, self.location.origin), 302);
          }
          return new Response("Luna is offline. Reopen the installed app once you have a connection.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }),
    );
    return;
  }

  if (!["script", "style", "font", "image"].includes(request.destination)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "COCOMELON_CACHE_OFFLINE_SHELL") return;
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cacheOfflineShell(cache))
      .catch(() => undefined),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "cocomelon-sync-transactions") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: "COCOMELON_SYNC_TRANSACTIONS" });
      }
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "You have a Luna update." };
  }

  event.waitUntil(self.registration.showNotification(payload.title || "Luna update", {
    body: payload.body || "You have a new Luna update.",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || "budget-alert",
    data: { url: payload.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const target = event.notification.data?.url || "/";
    const existing = clients.find((client) => "focus" in client);
    if (existing) {
      existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  }));
});
