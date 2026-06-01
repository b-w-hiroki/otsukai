// おうちのおつかい — Service Worker
// ナビゲーションはネットワーク優先（オンライン時は常に最新）、
// オフライン時のみキャッシュした app.html を返す。
const CACHE = "otsukai-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["./app.html", "./index.html"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate") return;
  const url = new URL(request.url);
  // アプリへのナビゲーションは app.html をキャッシュ
  const isApp = url.pathname.endsWith("app.html");
  const cacheKey = isApp ? "./app.html" : "./index.html";
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(cacheKey, copy));
        return response;
      })
      .catch(() => caches.match(cacheKey))
  );
});
