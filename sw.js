// おうちのおつかい — Service Worker
// ・ナビゲーションはネットワーク優先（オンライン時は常に最新）、オフライン時のみキャッシュを返す。
// ・Firebase SDK（gstatic.com）や設定・アイコンなどの静的アセットはプリキャッシュし、
//   キャッシュ優先で返す（圏外でもアプリが起動できるように）。
// アプリ本体 = app.html、紹介ページ = index.html（ルート）、プロジェクトハブ = hub.html。
const CACHE = "otsukai-v131";

const PRECACHE = [
  "./app.html",
  "./index.html",
  "./hub.html",
  "./privacy.html",
  "./guide.html",
  "./terms.html",
  "./contact.html",
  "./manifest.json",
  "./styles.css",
  "./app-core.js",
  "./app-requests.js",
  "./app-rewards.js",
  "./app-stock.js",
  "./app-mission-admin.js",
  "./app-render.js",
  "./app-notify.js",
  "./app-lowstock.js",
  "./app-history.js",
  "./app-init.js",
  "./firebase-config.js",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./docs/screenshots/01-home.png",
  "./shortcut-icons/apple.svg",
  "./shortcut-icons/avocado.svg",
  "./shortcut-icons/baby.svg",
  "./shortcut-icons/bacon.svg",
  "./shortcut-icons/banana.svg",
  "./shortcut-icons/battery.svg",
  "./shortcut-icons/beef.svg",
  "./shortcut-icons/beer.svg",
  "./shortcut-icons/bento.svg",
  "./shortcut-icons/blueberry.svg",
  "./shortcut-icons/bread.svg",
  "./shortcut-icons/broccoli.svg",
  "./shortcut-icons/broom.svg",
  "./shortcut-icons/bugspray.svg",
  "./shortcut-icons/bulb.svg",
  "./shortcut-icons/butter.svg",
  "./shortcut-icons/cabbage.svg",
  "./shortcut-icons/cake.svg",
  "./shortcut-icons/candy.svg",
  "./shortcut-icons/canned.svg",
  "./shortcut-icons/carrot.svg",
  "./shortcut-icons/cereal.svg",
  "./shortcut-icons/cheese.svg",
  "./shortcut-icons/cherry.svg",
  "./shortcut-icons/chicken.svg",
  "./shortcut-icons/chili.svg",
  "./shortcut-icons/chips.svg",
  "./shortcut-icons/chocolate.svg",
  "./shortcut-icons/cigarette.svg",
  "./shortcut-icons/clothes.svg",
  "./shortcut-icons/coffee.svg",
  "./shortcut-icons/contact.svg",
  "./shortcut-icons/corn.svg",
  "./shortcut-icons/cosmetics.svg",
  "./shortcut-icons/crab.svg",
  "./shortcut-icons/croissant.svg",
  "./shortcut-icons/cucumber.svg",
  "./shortcut-icons/curry.svg",
  "./shortcut-icons/daikon.svg",
  "./shortcut-icons/dango.svg",
  "./shortcut-icons/detergent.svg",
  "./shortcut-icons/dishsoap.svg",
  "./shortcut-icons/dumpling.svg",
  "./shortcut-icons/egg.svg",
  "./shortcut-icons/eggplant.svg",
  "./shortcut-icons/fish.svg",
  "./shortcut-icons/flour.svg",
  "./shortcut-icons/flower.svg",
  "./shortcut-icons/frozen.svg",
  "./shortcut-icons/garlic.svg",
  "./shortcut-icons/gift.svg",
  "./shortcut-icons/grapes.svg",
  "./shortcut-icons/honey.svg",
  "./shortcut-icons/icecream.svg",
  "./shortcut-icons/juice.svg",
  "./shortcut-icons/kitchen.svg",
  "./shortcut-icons/kiwi.svg",
  "./shortcut-icons/laundry.svg",
  "./shortcut-icons/lemon.svg",
  "./shortcut-icons/lettuce.svg",
  "./shortcut-icons/mango.svg",
  "./shortcut-icons/mask.svg",
  "./shortcut-icons/medicine.svg",
  "./shortcut-icons/melon.svg",
  "./shortcut-icons/milk.svg",
  "./shortcut-icons/mince.svg",
  "./shortcut-icons/mushroom.svg",
  "./shortcut-icons/noodle.svg",
  "./shortcut-icons/onion.svg",
  "./shortcut-icons/orange.svg",
  "./shortcut-icons/peach.svg",
  "./shortcut-icons/pear.svg",
  "./shortcut-icons/pepper.svg",
  "./shortcut-icons/persimmon.svg",
  "./shortcut-icons/pet.svg",
  "./shortcut-icons/pineapple.svg",
  "./shortcut-icons/pizza.svg",
  "./shortcut-icons/pork.svg",
  "./shortcut-icons/potato.svg",
  "./shortcut-icons/razor.svg",
  "./shortcut-icons/retort.svg",
  "./shortcut-icons/rice.svg",
  "./shortcut-icons/riceball.svg",
  "./shortcut-icons/sake.svg",
  "./shortcut-icons/salad.svg",
  "./shortcut-icons/salmon.svg",
  "./shortcut-icons/sanitary.svg",
  "./shortcut-icons/sausage.svg",
  "./shortcut-icons/seasoning.svg",
  "./shortcut-icons/shampoo.svg",
  "./shortcut-icons/shrimp.svg",
  "./shortcut-icons/snack.svg",
  "./shortcut-icons/soap.svg",
  "./shortcut-icons/soda.svg",
  "./shortcut-icons/spinach.svg",
  "./shortcut-icons/sponge.svg",
  "./shortcut-icons/squid.svg",
  "./shortcut-icons/stationery.svg",
  "./shortcut-icons/strawberry.svg",
  "./shortcut-icons/sushi.svg",
  "./shortcut-icons/sweetpotato.svg",
  "./shortcut-icons/tea.svg",
  "./shortcut-icons/tissue.svg",
  "./shortcut-icons/tofu.svg",
  "./shortcut-icons/toiletpaper.svg",
  "./shortcut-icons/tomato.svg",
  "./shortcut-icons/toothbrush.svg",
  "./shortcut-icons/toy.svg",
  "./shortcut-icons/trash.svg",
  "./shortcut-icons/umbrella.svg",
  "./shortcut-icons/water.svg",
  "./shortcut-icons/watermelon.svg",
  "./shortcut-icons/wine.svg",
  "./shortcut-icons/wrap.svg",
  "./shortcut-icons/yogurt.svg",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js"
];

self.addEventListener("install", (event) => {
  // skipWaiting は呼ばない。動作中のページから古いコードを突然差し替えると
  // HTML と JS の版が食い違うため、アプリ側の「更新する」操作を待って切り替える
  // （SKIP_WAITING メッセージで有効化）。
  // 初回インストール時は、古い SW に制御されたページが無いので仕様上そのまま
  // 有効化されるため、ここでの skipWaiting は不要。
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // cache.addAll は1つでも取得に失敗すると全体が失敗し、Service Worker 自体が
      // インストールされない（＝オフライン対応も更新検知も丸ごと効かなくなる）。
      // 個別に入れて、失敗しても続行する（そのファイルがオフラインで使えないだけ）。
      await Promise.all(
        PRECACHE.map(async (u) => {
          try {
            await cache.add(new Request(u, { cache: "reload" }));
          } catch (e) {
            console.warn("[sw] precache skipped:", u);
          }
        })
      );
    })()
  );
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

// アプリ側からの指示を受け取る
self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") {
    // 「更新」ボタン: 待機中の新バージョンを即有効化する
    self.skipWaiting();
  } else if (type === "CLEAR_CACHES") {
    // 「強制的に再取得」: 全キャッシュを捨てて次回取得をネットワークからにする
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => event.source && event.source.postMessage({ type: "CACHES_CLEARED" }))
    );
  } else if (type === "GET_VERSION") {
    if (event.source) event.source.postMessage({ type: "VERSION", version: CACHE });
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // ナビゲーション: ネットワーク優先 → 失敗時キャッシュ
  if (request.mode === "navigate") {
    // 紹介ページ（ルート）・アプリ本体・ハブをそれぞれ別のキーでキャッシュする。
    // それ以外（guide/terms/privacy/contact）はプリキャッシュ済みのファイル名で引く
    const path = url.pathname;
    const cacheKey = path.endsWith("app.html") ? "./app.html"
      : path.endsWith("hub.html") ? "./hub.html"
      : /\.html$/.test(path) ? "./" + path.split("/").pop()
      : "./index.html";
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
