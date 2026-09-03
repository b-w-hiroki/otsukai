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

         ┌─────────── Cloud Scheduler（5分ごと・Asia/Tokyo）───────────┐
         │ shoppingReminder: reminderIndex を読み、直近5分窓の設定時刻の    │
         │ 家族で未完了(open/claimed)の買い物があれば pushTokens へ FCM 送信 │
         │（該当なしの回は索引ノード1つの読み取りだけで終了）              │
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

## 3. お問い合わせフォームのメール通知（任意）

`contact.html` から送信されたお問い合わせは `submitContactForm` が受け取り、
まず Realtime Database の `contactMessages` に記録する（ここまでは追加設定不要）。
開発者宛てのメール通知も行うには、Gmail の SMTP 用に **アプリパスワード**を発行し、
Secret Manager に登録する：

1. 通知を受け取りたい Google アカウントで、[Googleアカウントの管理 → セキュリティ](https://myaccount.google.com/security) → **2段階認証を有効化**（未設定なら先に済ませる）
2. 同じ画面から **アプリパスワード** を作成（アプリ名は「otsukai」など任意）。表示された16桁の文字列を控える
3. リポジトリのルートで:

```bash
firebase functions:secrets:set CONTACT_GMAIL_USER
# → 通知を受け取りたい Gmail アドレスを入力

firebase functions:secrets:set CONTACT_GMAIL_APP_PASSWORD
# → 手順2で発行した16桁のアプリパスワードを入力
```

4. `firebase deploy --only functions` でデプロイ

未設定のままでも動作は壊れない（`contactMessages` への記録だけ行われ、メール送信はスキップされる）。
Firebase Console の Realtime Database から `contactMessages` を見れば内容は確認できる。

**注意**: アプリパスワードは**発行したアカウント本人のアドレス**としか組み合わせられない。
`CONTACT_GMAIL_USER` に入れたアドレスのアカウントでログインした状態で発行すること
（別アカウントで発行すると `535-5.7.8 Username and Password not accepted` で送信に失敗する）。
表示される「abcd efgh ijkl mnop」の空白は関数側で取り除くので、そのまま貼っても構わない。

値の確認・修正:

```bash
firebase functions:secrets:access CONTACT_GMAIL_USER          # 今の値を表示
firebase functions:secrets:set CONTACT_GMAIL_APP_PASSWORD     # 登録し直し（新バージョンになる）
firebase deploy --only functions:submitContactForm            # 変更後はこの関数だけ再デプロイで反映
firebase functions:log --only submitContactForm               # 送信失敗の理由を見る
```

## 4. Realtime Database のルール（必須）

リポジトリ直下に **`database.rules.json`** を用意しています。
家族メンバーだけが家族データを読み書きでき、`reminderTimes` / `pushTokens` /
`reminderIndex` / `settings` も動作するよう構成しています。

**適用手順の正本は [`docs/rules/deploy.md` §2](../docs/rules/deploy.md#2-realtime-database-のルール適用手動正本)**。
`firebase deploy` では反映されない（意図的に `firebase.json` に含めていない）ので、
Firebase Console から手で貼る必要があります。

---

## デプロイ手順

→ **正本は [`docs/rules/deploy.md` §3](../docs/rules/deploy.md#3-cloud-functions-のデプロイ)**。

このディレクトリ固有の注意だけ書いておく:

- `firebase.json` は **functions のみ**を対象にしている（Realtime Database のルールや
  Hosting は含めない）。既存の DB ルールと GitHub Pages 配信をデプロイで上書きしないため
- 依存は `functions/package.json`。デプロイ前に `cd functions && npm install`

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

## 含まれる関数（10個）

| 関数 | トリガー | 内容 |
|---|---|---|
| `shoppingReminder` | 5分ごと（Scheduler） | 設定時刻（5分きざみ）に未完了の買い物があれば家族へリマインド |
| `notifyNewRequest` | requests onCreate | 新しい依頼を家族へプッシュ（指名ありは本人だけ、急ぎは🔥） |
| `notifyStatusChange` | requests onUpdate | 立候補・完了を依頼者本人へプッシュ |
| `notifyReaction` | reactions onCreate | 「ありがとう」を完了した本人へプッシュ（依頼×人ごとに1回だけ） |
| `awardPoints` | requests onUpdate | 完了でポイント付与・取り消しで返却（**サーバー側で付与＝偽造不可**）＋ウィークリーミッションの進捗記録・達成判定 |
| `notifyRewardRedeem` | rewardLogs onCreate | ごほうび交換を本人以外へプッシュ＋交換履歴を最新50件にローテーション |
| `weeklySummary` | 毎週日曜 20:00 JST | 週の完了件数とMVPを家族全員へ配信（完了ゼロなら送らない） |
| `archiveOldRequests` | 毎日 03:15 JST | 完了から90日過ぎた依頼とコメントを `archive/` へ移動＋古い週次ミッションデータの掃除 |
| `deleteMemberAccount` | callable（**本人のみ**。役割問わず自分自身のアカウントをいつでも削除可） | 自分のアカウント完全削除。他人の指定は permission-denied で拒否。**最後の保護者は削除不可**（家族ロック防止） |
| `submitContactForm` | callable（`contact.html`から・未ログインでも可） | お問い合わせを `contactMessages` に記録し、Gmail SMTP経由で開発者へメール通知（未設定ならDB記録のみ） |

`firebase deploy --only functions` でまとめてデプロイされます。

> ⚠️ **デプロイ必須の機能**
> - アカウント削除（設定 → メンバー管理、または設定 → プロフィールの自分自身の削除）は
>   `deleteMemberAccount` のデプロイ後に動作
> - **ごほうびポイントの付与は `awardPoints` のデプロイ後に動作**します（子どもによる
>   ポイント偽造を防ぐため、付与をサーバー側に移しました）。未デプロイの間は
>   完了してもポイントが増えません（交換は残高があれば動きます）
> - お問い合わせフォーム（`contact.html`）は `submitContactForm` のデプロイ後に動作。
>   未デプロイの間は送信ボタンを押してもエラーになります

## メモ / 調整ポイント

- 通知時刻は **家族で共有**（`families/{id}/reminderTimes`）。各メンバーが「通知をオン」にすると、その端末トークンが家族の `pushTokens` に登録され、設定時刻に届きます。
- 通知を受け取りたくないメンバーは、アプリの設定 → 通知 → 「通知をオフにする」で**端末単位**で止められます（家族の設定時刻には影響しません）。
- リマインドは5分ごとの起動（直近5分窓をまとめて判定）で、アプリ側の時刻入力も5分きざみに丸めています。
- 無効になった端末トークンは送信失敗時に自動削除されます。
- アーカイブの保持期間は `index.js` の `ARCHIVE_AFTER_DAYS`（既定90日）で調整できます。アーカイブされたデータは削除ではなく `families/{id}/archive/` に残ります。


---

## コスト最適化（限りなく0円運用のために）

→ **正本は [`docs/rules/deploy.md` §5](../docs/rules/deploy.md#5-コストを増やさないための決め事)**。

このディレクトリのコードで守っている前提（5分ごと起動 / 128MB / `asia-southeast1` /
Scheduler 3ジョブ以内 / 90日アーカイブ）は、**変更すると課金に直結する**ので
上のルールを読んでから触ること。
