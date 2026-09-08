# DB構造の早見表（Realtime Database）

> ⚠️ **これは早見表であり、正本ではない。** 権限・バリデーションの正本は
> [`database.rules.json`](../database.rules.json)、実際のフィールドの正本はコード
> （`app-*.js` / `functions/index.js`）。両方とここが食い違ったら、コードとルールを正として
> このファイルを直す（自動チェックは無いので、フィールドを足す/変えるたびに手で直す）。
>
> Realtime Databaseは1つの巨大なJSONツリー（SQLのテーブルではない）。以下は
> パスごとに「何が入っているか」を人が読みやすくまとめたもの。

---

## 全体のツリー構造

```
/
├── users/{uid}                          … アカウント単位の情報（家族に依存しない）
├── invites/{code}                       … 招待コード → familyId（文字列1つだけ）
├── errors/{pushId}                      … クライアントの未捕捉エラーログ（書き込みのみ、読み取り不可）
├── reminderIndex/{time}/{familyId}      … リマインド時刻の逆引きインデックス（サーバー用）
├── contactMessages/{pushId}             … お問い合わせフォームの送信内容（サーバーのみ書き込み）
├── notifDedup/reactions/{familyId}/{requestId}_{uid}  … リアクション通知の重複防止（サーバーのみ）
└── families/{familyId}/
    ├── meta                             … 家族名・作成日時など
    ├── members/{uid}                    … 家族メンバーの一覧
    ├── requests/{id}                    … おつかい（買い物依頼）
    ├── extraExpenses/{id}               … その他の支出ログ
    ├── comments/{requestId}/{commentId} … 依頼へのコメント
    ├── stats/{uid}                      … 依頼数・宣言数・完了数の集計
    ├── shortcuts/{id}                   … よく買うもの
    ├── destinations/{id}                … 行き先（お店）
    ├── stocks/{id}                      … ストック（在庫）
    ├── missions/{id}                    … 保護者が出すミッション
    ├── missionLogs/{missionId}/{uid}    … ミッション達成ログ
    ├── weekly/{weekKey}/{uid}           … 週次ミッションの進捗（サーバーのみ書き込み）
    ├── reminderTimes/{HH:MM}            … リマインド時刻の集合（値は常にtrue）
    ├── settings/lowLeadDays             … 「そろそろ切れるかも」を知らせる日数
    ├── pushTokens/{token}               … FCMプッシュ通知トークン（キーがトークン自体）
    ├── points/{uid}                     … ポイント残高（数値のみ）
    ├── rewards/{id}                     … ごほうびの一覧（保護者のみ作成）
    ├── rewardLogs/{id}                  … ごほうび交換ログ
    └── archive/requests|comments/{id}   … 90日経過した完了データ（サーバーのみ・クライアント非公開）
```

---

## users/{uid}

アカウント単位（家族をまたいでも変わらない）。`app-core.js` のみが読み書きする。

| フィールド | 型 | 必須 | 用途 |
|---|---|---|---|
| `name` | string | ○（無いとプロフィール作成画面へ） | 表示名 |
| `emoji` | string | 任意（既定 `🙂`） | アイコン絵文字 |
| `email` | string | 任意 | 初回プロフィール作成時のみ書く |
| `familyId` | string | 任意（未参加なら無し） | 所属家族 |
| `onboardingSeen` | boolean | 任意 | 初回オンボーディングを見たか |
| `updatedAt` | number(ms) | 任意 | 初回プロフィール作成時のみ書く |

> ⚠️ `email` と `updatedAt` は設定タブからの編集（`updateProfileFromSettings`）では**更新されない**。
> 初回作成時にしか書かれないので、古いままになりうる。

## invites/{code}

**値は文字列1つ**（`familyId` そのもの。オブジェクトではない）。家族作成時に発行し、
参加時に読んで消費する。最後の1人が退会するときに削除される。

## errors/{pushId}

`.read: false`（Console からのみ確認）。`message`（最大500字）・`stack`（最大1500字）・
`uid`・`ua`（UserAgent）・`at`。1セッション最大10件まで。

## reminderIndex/{time}/{familyId}

値は常に `true`。`families/{id}/reminderTimes` と対で書かれる逆引きインデックスで、
サーバーの `shoppingReminder` が5分ごとにここをスキャンする。

## contactMessages/{pushId}

`contact.html` → `submitContactForm` 関数のみが書く（クライアントからは書けない）。
`name` / `company`（任意） / `email` / `phone`（任意） / `subject` / `message` / `agreed` / `createdAt`。

## notifDedup/reactions/{familyId}/{requestId}_{uid}

サーバーのみ。同じ組み合わせの💬リアクション通知を連発させないための重複防止マーカー。

---

## families/{familyId}/meta

`name` / `createdAt` / `inviteCode`（招待コードの文字列。上の `invites/{code}` のキーと同じ値） / `createdBy`。

## families/{familyId}/members/{uid}

| フィールド | 型 | 用途 |
|---|---|---|
| `name` / `emoji` / `joinedAt` | | 表示用 |
| `role` | `"admin"` \| `"member"` | **DBルールだけが見る**古い区分。招待/参加時に決まり、以後クライアントは変更しない |
| `memberRole` | `"parent"` \| `"sub-parent"` \| `"child"` | **アプリのUI/権限が実際に見る**区分。`isParent()` や設定タブでいつでも変更可能 |

> ⚠️ **`role` と `memberRole` は別物。** `role: admin` は招待コード発行・家族ノード自体の書き込み・
> `points` の増額に必要（DBルール側）。`memberRole: parent` はアプリの機能表示（メンバー管理カード等）を
> 制御する（app側）。副保護者を「保護者」に昇格しても `role` は `member` のままなので、
> 招待コードの発行やポイント加算はサーバー関数経由でしかできない（Admin SDKはルールを迂回するため無関係）。

## families/{familyId}/requests/{id}（おつかい）

| フィールド | 型 | 必須/任意 |
|---|---|---|
| `name` | string | ○ |
| `diff` | `"normal"` \| `"hard"` \| `"extreme"` | ○（既定 normal） |
| `urgent` | boolean | ○ |
| `status` | `"open"` \| `"claimed"` \| `"done"` | ○ |
| `requestedBy` / `requestedAt` | string(uid) / number(ms) | ○ |
| `category` | `"food"` \| `"daily"` \| `"other"` | UI上は必須（古いデータには無い場合あり） |
| `budget` | number | 任意（買う前の予算上限） |
| `actualCost` | number | 任意（**実際に払った額**。`budget`とは別物、履歴の💴から記録） |
| `brand` / `memo` / `destination` / `assignedTo` / `photoUrl` | | すべて任意 |
| `claimedBy` / `claimedAt` | | 「買うよ」宣言時にセット |
| `completedBy` / `completedAt` | | 完了時にセット |
| `reactions` | object `{uid: 絵文字}` | 任意 |

宣言・完了はRTDBトランザクションで二重処理を防止。

## families/{familyId}/extraExpenses/{id}

`amount`（必須） / `addedBy` / `addedAt` / `memo`（任意）。買い物リスト以外の支出記録。

## families/{familyId}/comments/{requestId}/{commentId}

`text` / `authorUid` / `authorEmoji` / `authorName` / `createdAt` / `parentId`（返信先コメントIDか`null`。1段階のスレッド返信に使用）。

## families/{familyId}/stats/{uid}

`requestedCount` / `claimedCount` / `completedCount` / `lastActiveAt`（最終活動日時。トランザクションで加減算）。
リセットは保護者がノードごと削除。

## families/{familyId}/shortcuts/{id}（よく買うもの）

`name` / `diff` / `urgent` / `createdBy` / `createdAt`（必須）+ `memo` / `budget` / `brand` /
`assignedTo` / `category` / `destination` / `photoUrl`（任意）。

> ⚠️ 登録シートに「買う間隔」欄があるが、その値は shortcuts 自体には保存されない。
> `ensureStockForShortcut()` によってペアの **stocks** 側に書き込まれる。

## families/{familyId}/destinations/{id}（行き先）

`name` / `createdAt` / `createdBy`。並び順は登録順（`createdAt`）で、五十音順ではない。

## families/{familyId}/stocks/{id}

`name` / `level`（`"ok"` \| `"low"` \| `"out"`） / `updatedBy` / `updatedAt`（必須）+
`category` / `destination` / `memo` / `budget` / `cycleDays` / `lastFilledAt` / `photoUrl`（任意）。
`lastFilledAt` は🟢たっぷりに戻すたび、または `cycleDays` を初めて設定したときに起点として入る。

## families/{familyId}/missions/{id} と missionLogs/{missionId}/{uid}

- `missions/{id}`: `title` / `targetCount` / `reward` / `assignedTo` / `createdBy` / `createdAt` / `status`（`"active"` \| `"archived"`）
- `missionLogs/{missionId}/{uid}`: `count`（達成回数、トランザクションで加算） / `claimPending` / `paid`

> ⚠️ `claimPending` は書き込まれるが、どの画面からも読み返されていない（使われていない可能性が高い）。

## families/{familyId}/weekly/{weekKey}/{uid}

**サーバー（Cloud Functions の Admin SDK）だけが書き込む。** クライアントは読み取り専用。
`database.rules.json` にこのパス専用の `.write` ルールが無いのはこのため（クライアントが
書こうとすること自体が無いので、家族ノードの管理者限定ルールへのフォールバックが実質発動しない）。

`completed` / `urgentCompleted` / `reactionsSent`（数値） / `awards`（`{ミッションID: 達成日時}`）。
古い週キーは直近5週分だけ残してサーバーが間引く。

## families/{familyId}/reminderTimes

`{"HH:MM": true}` の集合。値は常に `true`（回数や日時ではない）。`reminderIndex`（トップレベル）と対で更新される。

## families/{familyId}/settings

`lowLeadDays`（0〜60の数値）のみ。DBルールの `.validate` が実際に効いている唯一のフィールド。
テーマ・サウンド等の端末設定は `localStorage` のみで、ここには保存されない。

## families/{familyId}/pushTokens/{token}

**キーがFCMトークン自体**（uidではない）。値は `uid` / `name` / `updatedAt`。
トークンのローテーション時・サインアウト時・送信失敗時にサーバー側でも削除される。

## families/{familyId}/points/{uid}

数値のみ。増額は保護者かサーバー（`awardPoints`）経由のみ。本人による書き込みは**減らす方向のみ**
許可（ごほうび交換で消費するため）。

## families/{familyId}/rewards/{id} と rewardLogs/{id}

- `rewards/{id}`: `name` / `cost` / `createdBy` / `createdAt`。書き込みは `memberRole === "parent"` のみ
- `rewardLogs/{id}`: `rewardId` / `name` / `cost` / `uid` / `at`。本人の交換記録のみ書け、上書き不可。直近50件のみサーバーが保持

## families/{familyId}/archive/requests·comments/{id}

完了から90日経過（`ARCHIVE_AFTER_DAYS`）した依頼とそのコメントを、サーバーが**まとめて**
（`update()` 1回で）ここへ移す。DBルールにこのパスの定義が無く、クライアントからは読み書き
どちらもできない（ルート既定の `false` がそのまま効く）。

---

## 用語メモ

- 「早見表」なので、フィールドを追加・変更したら**このファイルも手で直す**（`docs-check.mjs` の
  二重管理チェックは `docs/` 配下のテキストの重複しか見ず、コードとの一致は保証しない）。
- 正確な権限ロジック（誰が何を書けるか）は必ず [`database.rules.json`](../database.rules.json) を見る。
  このファイルは「何が入っているか」の説明であり、「誰が書けるか」の説明ではない。
