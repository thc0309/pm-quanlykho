const CACHE = "warehouse-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/warehouse-192.svg", "/icons/warehouse-512.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put("/", copy)); return response; }).catch(() => caches.match("/")));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
