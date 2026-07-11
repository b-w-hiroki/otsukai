# 買い物リマインドのプッシュ通知 — セットアップ手順

「設定画面で指定した時刻に、未完了の買い物があれば家族のスマホへプッシュ通知」を実現するためのサーバー側（Cloud Functions + Cloud Scheduler）です。

> アプリ本体（`index.html` / `firebase-messaging-sw.js`）のクライアント実装は導入済みです。
> このディレクトリの関数をデプロイし、下記の **3点（VAPIDキー / Blaze / DBルール）** を設定すると有効になります。

---

## 仕組み

```
[設定画面で時刻を登録] ──→ families/{id}/reminderTimes/{"HH:MM"} = true
                        └→ reminderIndex/{"HH:MM"}/{familyId}    = true（逆引き索引）
[通知をオンにする]      ──→ families/{id}/pushTokens/{token}      = {uid,name,updatedAt}

         ┌──────────── Cloud Scheduler（毎分・Asia/Tokyo）────────────┐
         │ shoppingReminder: reminderIndex/{現在時刻} を読み、該当家族の   │
         │ 未完了(open/claimed)の買い物があれば pushTokens へ FCM 送信      │
         │（該当なしの分は索引ノード1つの読み取りだけで終了）              │
         └────────────────────────────────────────────────────────────┘
```

---

## 1. VAPID キー（クライアント側・必須）

1. Firebase Console → ⚙️ プロジェクトの設定 → **Cloud Messaging** タブ
2. 「ウェブプッシュ証明書（Web Push certificates）」で鍵ペアを生成
3. 表示された公開鍵をリポジトリ直下の **`firebase-config.js`** に貼り付ける：

```js
self.FIREBASE_VAPID_KEY = "ここに貼り付け";
```

これを設定しないと、アプリの「通知をオンにする」は有効化できません。

## 2. Blaze プラン（必須）

Cloud Functions / Cloud Scheduler は **Blaze（従量課金）プラン**が必要です。
- Firebase Console → 左下「アップグレード」→ Blaze
- 毎分起動でも無料枠内に収まることが多いですが、課金が発生し得る点はご認識ください。

## 3. Realtime Database のルール（必須）

リポジトリ直下に **`database.rules.json`（ドラフト）** を用意しています。
家族メンバーだけが家族データを読み書きでき、`reminderTimes` / `pushTokens` /
`reminderIndex` も動作するよう構成しています。

> ⚠️ 適用前に、**現在 Firebase Console に設定されているルールと必ず突き合わせてください**。
> 意図的に `firebase.json` には含めていないため `firebase deploy` では上書きされません。
> 内容を確認のうえ、Firebase Console → Realtime Database → ルール に手動で貼り付けて
> 「シミュレーター」でログイン/参加/追加の各操作を試してから公開するのが安全です。

---

## デプロイ手順

`firebase.json` と `.firebaserc`（プロジェクト `otsukai-app-4b62b` 指定）はリポジトリに同梱済みなので、`firebase init` は不要です。

```bash
# 初回のみ
npm install -g firebase-tools
firebase login

# 依存をインストール
cd functions
npm install
cd ..

# デプロイ（Cloud Scheduler ジョブも自動作成されます）
firebase deploy --only functions
```

> `firebase.json` は **functions のみ**を対象にしています（Realtime Database のルールや
> Hosting は含めていません）。これは既存の DB ルールや GitHub Pages 配信を
> デプロイで上書きしないための配慮です。DB ルールは Firebase Console から手動で調整してください。

---

## 動作確認

1. アプリの設定 → 通知 → 「通知をオンにする」で許可（トークンが `pushTokens` に入る）
2. 設定 → 通知 → 「通知する時刻」に、1〜2分後の時刻を追加
3. 買い物リストに未完了アイテムを1つ残しておく
4. その時刻に通知が届けば成功（端末がスリープでも届きます）

ログ確認：

```bash
firebase functions:log --only shoppingReminder
```

---

## 含まれる関数（6つ）

| 関数 | トリガー | 内容 |
|---|---|---|
| `shoppingReminder` | 毎分（Scheduler） | 設定時刻に未完了の買い物があれば家族へリマインド |
| `notifyNewRequest` | requests onCreate | 新しい依頼を家族へプッシュ（指名ありは本人だけ、急ぎは🔥） |
| `notifyStatusChange` | requests onUpdate | 立候補・完了を依頼者本人へプッシュ |
| `notifyReaction` | reactions onCreate | 「ありがとう」リアクションを完了した本人へプッシュ |
| `weeklySummary` | 毎週日曜 20:00 JST | 週の完了件数とMVPを家族全員へ配信（完了ゼロなら送らない） |
| `archiveOldRequests` | 毎日 03:15 JST | 完了から90日過ぎた依頼とコメントを `archive/` へ移動 |

`firebase deploy --only functions` でまとめてデプロイされます。

## メモ / 調整ポイント

- 通知時刻は **家族で共有**（`families/{id}/reminderTimes`）。各メンバーが「通知をオン」にすると、その端末トークンが家族の `pushTokens` に登録され、設定時刻に届きます。
- 通知を受け取りたくないメンバーは、アプリの設定 → 通知 → 「通知をオフにする」で**端末単位**で止められます（家族の設定時刻には影響しません）。
- 毎分起動が気になる場合は、`index.js` の `schedule("* * * * *")` を `"*/5 * * * *"` 等に変え、アプリ側の時刻入力も5分刻みに丸めると呼び出し回数を減らせます。
- 無効になった端末トークンは送信失敗時に自動削除されます。
- アーカイブの保持期間は `index.js` の `ARCHIVE_AFTER_DAYS`（既定90日）で調整できます。アーカイブされたデータは削除ではなく `families/{id}/archive/` に残ります。
