// Service Worker — Ro'yxat PWA
// MUHIM: GitHub API so'rovlari cache ga tushmaydi!
const CACHE = "spiska-v2";
const ASSETS = [
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = e.request.url;

  // GitHub API so'rovlarini HECH QACHON cache ga tushurmang!
  if (url.includes("api.github.com") || url.includes("github.com")) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Faqat GET so'rovlarini cache dan qaytarish
  if (e.request.method !== "GET") {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
