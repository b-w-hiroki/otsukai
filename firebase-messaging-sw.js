/* おうちのおつかい — FCM バックグラウンド受信用 Service Worker
 * アプリを閉じている/バックグラウンドのときに届くプッシュ通知を表示する。
 * メインの sw.js（キャッシュ用）とは別物。getToken に serviceWorkerRegistration として渡す。
 */
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCvG_SliXyI3grYhYS-GhFk-qCP1DMyGqI",
  authDomain: "otsukai-app-4b62b.firebaseapp.com",
  databaseURL: "https://otsukai-app-4b62b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "otsukai-app-4b62b",
  storageBucket: "otsukai-app-4b62b.firebasestorage.app",
  messagingSenderId: "422978533670",
  appId: "1:422978533670:web:aab3f42c2c9cea61ad29e7",
  measurementId: "G-12RXRBWGVP"
});

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
