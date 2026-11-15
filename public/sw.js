/* Service Worker „Finanzen" – App-Shell offline, Seiten network-first. */
const VERSION = "v1";
const SHELL_CACHE = `finanzen-shell-${VERSION}`;
const PAGE_CACHE = `finanzen-pages-${VERSION}`;
const ASSET_CACHE = `finanzen-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL_CACHE, PAGE_CACHE, ASSET_CACHE];
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  // Beim Abmelden alle zwischengespeicherten Seiten löschen
  if (event.data === "clear-pages") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

function isPublic(pathname) {
  return pathname.startsWith("/login") || pathname === "/kein-zugriff" || pathname === OFFLINE_URL;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Unveränderliche Build-Dateien: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Seitenaufrufe: network-first, Fallback auf zuletzt geladene Version bzw. Offline-Seite
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          const res = preload || (await fetch(request));
          if (res.ok && res.type === "basic" && !res.redirected && !isPublic(url.pathname)) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(url.pathname, res.clone());
          }
          return res;
        } catch {
          const cache = await caches.open(PAGE_CACHE);
          const cached = await cache.match(url.pathname);
          return cached || (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
  }
});
