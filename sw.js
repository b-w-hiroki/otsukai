// おうちのおつかい — Service Worker
// ・ナビゲーションはネットワーク優先（オンライン時は常に最新）、オフライン時のみキャッシュを返す。
// ・Firebase SDK（gstatic.com）や設定・アイコンなどの静的アセットはプリキャッシュし、
//   キャッシュ優先で返す（圏外でもアプリが起動できるように）。
// アプリ本体 = index.html（ルート）、プロジェクトハブ = hub.html。
const CACHE = "otsukai-v13";

const PRECACHE = [
  "./index.html",
  "./hub.html",
  "./manifest.json",
  "./styles.css",
  "./app.js",
  "./firebase-config.js",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
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
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // ナビゲーション: ネットワーク優先 → 失敗時キャッシュ
  if (request.mode === "navigate") {
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
    return;
  }

  // 静的アセット（同一オリジンの静的ファイル / Firebase SDK）: キャッシュ優先 → ネットワーク補充
  const isSameOriginStatic =
    url.origin === self.location.origin &&
    /\.(js|css|png|json|ico|svg)$/.test(url.pathname);
  const isFirebaseSdk = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  if (isSameOriginStatic || isFirebaseSdk) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
      )
    );
  }
});
