// おうちのおつかい — Service Worker
// ナビゲーションはネットワーク優先（オンライン時は常に最新）、
// オフライン時のみキャッシュしたページを返す。
// アプリ本体 = index.html（ルート）、プロジェクトハブ = hub.html。
const CACHE = "otsukai-v7";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["./index.html", "./hub.html"])));
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
  // ハブへのナビゲーションは hub.html、それ以外（ルート＝アプリ）は index.html をキャッシュ
  const isHub = url.pathname.endsWith("hub.html");
  const cacheKey = isHub ? "./hub.html" : "./index.html";
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
