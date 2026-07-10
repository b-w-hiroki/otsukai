/* おうちのおつかい — FCM バックグラウンド受信用 Service Worker
 * アプリを閉じている/バックグラウンドのときに届くプッシュ通知を表示する。
 * メインの sw.js（キャッシュ用）とは別物。getToken に serviceWorkerRegistration として渡す。
 */
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");
importScripts("./firebase-config.js");

firebase.initializeApp(self.FIREBASE_CONFIG);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = (payload && payload.notification) || {};
  const data = (payload && payload.data) || {};
  self.registration.showNotification(n.title || "🧺 おうちのおつかい", {
    body: n.body || "買い物リストを確認しよう",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: data.tag || "otsukai-reminder",
    data: { url: data.url || "./" }
  });
});

// 通知タップでアプリを開く（既に開いていればフォーカス）。
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
