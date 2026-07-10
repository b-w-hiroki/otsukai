// おうちのおつかい — Firebase 共有設定
// index.html と firebase-messaging-sw.js の両方から読み込む唯一の設定ファイル。
// ここを書き換えれば両方に反映される（手動で2ファイルを同期する必要はない）。
self.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCvG_SliXyI3grYhYS-GhFk-qCP1DMyGqI",
  authDomain: "otsukai-app-4b62b.firebaseapp.com",
  databaseURL: "https://otsukai-app-4b62b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "otsukai-app-4b62b",
  storageBucket: "otsukai-app-4b62b.firebasestorage.app",
  messagingSenderId: "422978533670",
  appId: "1:422978533670:web:aab3f42c2c9cea61ad29e7",
  measurementId: "G-12RXRBWGVP"
};

// FCM Web Push 用の VAPID 公開鍵。
// Firebase Console → プロジェクト設定 → Cloud Messaging → ウェブプッシュ証明書 で生成して貼り付けると
// 「閉じてても届くプッシュ通知」が有効化できる（未設定の間は通知オンにできない）。
self.FIREBASE_VAPID_KEY = "YOUR_VAPID_KEY";
