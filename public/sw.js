/*
 * Service Worker: nur die Offline-Seite und die Icons werden gespeichert.
 * Seiten und Finanzdaten gehen immer ans Netz und landen nie im Cache -
 * auf einem verlorenen Handy liegt so nichts davon offline herum.
 */
const CACHE = "finanzen-shell-v1";
const SHELL = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Nur Seitenaufrufe: bei fehlendem Netz die Offline-Seite zeigen
  if (request.mode !== "navigate") return;
  event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
});
