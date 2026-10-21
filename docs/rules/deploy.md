# デプロイと運用のルール

このリポジトリの**リリース手順・反映の仕組み・課金に関わる操作**の正本。
`functions/README.md` はサーバー関数の中身の説明、こちらは**出し方**を扱う。

---

## 1. リリース時に必ずやること

| # | やること | 忘れるとどうなる |
|---|---|---|
| 1 | `sw.js` の `CACHE = "otsukai-vNN"` を**上げる** | 利用者に新しいコードが届かない。更新バナーも出ない |
| 2 | `node --check app-*.js` / `node --check functions/index.js` | 構文エラーが本番に出る |
| 3 | 回帰スイートを通す（→ `workflow.md`） | 直したはずの不具合が戻る |
| 4 | サーバーを変えたなら `firebase deploy --only functions` | 画面と通知の判定がズレる |
| 5 | DBルールを変えたなら **Firebase Console に手で貼る** | 書き込みが権限エラーで落ちる |
| 6 | 📣お知らせの記事（`news.js`）は**頼まれたときだけ**先頭に1件足す。頼まれていない更新では足さない（書き方はファイル冒頭のコメント） | 先頭が変わるたびに全端末へ赤丸とモーダルが出るため、細かい更新ごとに足すと通知がうるさくなる |

**4 と 5 はコード側では完結しない。** PR を出したら、本文に「デプロイ後にやること」として明記する。

---

## 2. Realtime Database のルール適用（手動・正本）

`database.rules.json` は**意図的に `firebase.json` に含めていない**。
`firebase deploy` で既存ルールを上書きしないための措置。

適用手順:

1. Firebase Console → Realtime Database → **ルール**
2. 現在設定されているルールと `database.rules.json` を**突き合わせる**
3. 貼り付けて、**シミュレーター**でログイン / 家族参加 / 依頼追加を試す
4. 問題なければ公開

> ⚠️ ルールを足したのに適用を忘れると、その機能だけ静かに失敗する。
> 例: `families/{id}/settings` の追加を忘れると「知らせる時期」が保存できない。

### Storage のルール

写真は Firebase Storage に置く。パスは3つ:

| 用途 | パス |
|---|---|
| ストックの写真 | `families/{familyId}/stocks/{stockId}` |
| おつかいの写真 | `families/{familyId}/requests/{requestId}` |
| よく買うものの写真 | `families/{familyId}/shortcuts/{shortcutId}` |

Storage のルールも Console 管理（リポジトリに `storage.rules` は置いていない）。
**`families/{familyId}/{allPaths=**}` でまとめて許可**しているため、上表のようにパスが
増えても追加作業は不要（既に済んでいるルールでそのまま動く）。

Firebase Console → Storage → ルール に、そのまま貼れる内容:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 家族の写真（ストック・おつかい）
    match /families/{familyId}/{allPaths=**} {
      allow read: if request.auth != null;
      // 画像だけ・5MBまで。アプリ側で長辺1000pxに圧縮しているので通常は150KB前後
      allow create, update: if request.auth != null
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
      allow delete: if request.auth != null;
    }
  }
}
```

> ⚠️ **Storage のルールから RTDB のメンバー表は参照できない**（別サービスのため）。
> そのため「ログイン済みなら家族の写真を読み書きできる」までしか絞れない。
> サイズと種類の制限を入れておくと、万一の悪用でも課金が膨らまない。
>
> 権限が無いと**写真だけ**保存されない（依頼やストックの内容は保存される）。

---

## 3. Cloud Functions のデプロイ

`firebase.json` と `.firebaserc`（プロジェクト `otsukai-app-4b62b`）は同梱済みなので `firebase init` は不要。

```bash
npm install -g firebase-tools   # 初回のみ
firebase login                  # 初回のみ
cd functions && npm install && cd ..
firebase deploy --only functions
```

ログ確認: `firebase functions:log --only shoppingReminder`

**デプロイしないと動かない機能**（未デプロイでも画面は動くので気づきにくい）:

| 機能 | 依存する関数 |
|---|---|
| ごほうびポイントの付与 | `awardPoints` |
| メンバーのアカウント削除 | `deleteMemberAccount` |
| 買い物リマインド・週次サマリー | `shoppingReminder` / `weeklySummary` |
| お問い合わせフォーム（`contact.html`） | `submitContactForm` |

関数ごとの責務は `functions/README.md` を参照。

---

## 4. PWA の更新が届く仕組み（3段構え）

PWA は `app-*.js` / `styles.css` をキャッシュ優先で配信するため、放置すると古い版で固定される。
そのため次の3段構えを入れている。

1. **自動検知＋強制アップデート** — 新バージョンを検知したら、**操作の邪魔にならない安全な
   タイミング**（シート/モーダルが何も開いておらず、入力欄にフォーカスも無く、画面が
   見えている）になり次第、数秒おきに見に行って全画面モーダルを出す（ソシャゲの強制
   アップデートと同じ見た目）。閉じるボタンは無く、背面も操作できない。「アップデート」を
   押すまでは先に進めない（`isSafeToAutoUpdate()` / `scheduleForcedUpdate()`、app-init.js）
2. **定期チェック** — 起動時・アプリに戻ったとき・1時間ごと（`updateViaCache: "none"`）
3. **手動復旧** — 設定 → 🔧 メンテナンス
   - 🔄 データを再読み込み（SWの更新チェック。家族データは既にリアルタイム同期済みのため
     リスナーは張り直さない — 張り直すと全サブツリーの無駄な再取得になる）
   - ⬇️ アプリを最新版に更新（全キャッシュ破棄）
   - 🚪 強制ログアウト（端末の設定もリセット）

加えて、ホーム画面を**下に引っ張ると更新**（pull-to-refresh）できる。

### 実装上の落とし穴（過去に踏んだもの）

- `install` で `skipWaiting()` を**呼ばない**。呼ぶと入力中に勝手にリロードされる
- 同じ理由で、**強制アップデートのモーダルも無条件には出さない**。`isSafeToAutoUpdate()` の条件
  （シート/モーダル未使用・入力欄フォーカス無し・画面が見えている）を必ず経由すること
- `cache.addAll` は1つ失敗すると全体が失敗し SW ごと入らない → **個別に `cache.add` + try/catch**
- `controllerchange` は初回インストールでも発火する → `updateRequested` と `hadControllerAtStart` で守る
- HTMLはネットワーク優先・JSはキャッシュ優先なので、デプロイ直後は「新HTML＋更新前の古いJS」
  が一時的に混在する（SWが切り替わるまで数十分〜1時間）。この間に古いJSが新HTMLに無い要素を
  `$(id)` で参照すると例外になり、`init()` がそこで丸ごと止まって**画面が真っ白のまま進まなく
  なる**（実際に発生した障害。`wireGlobalEvents()` 等はこのため個別に try/catch で守っている）。
  HTML側の要素IDを消す・変えるときは、この移行期間があることを踏まえる
- 同じ「真っ白のまま固まる」系統として、**Firebase SDK（`gstatic.com`）自体が読み込めない**
  ケースもある（広告ブロッカーやプライバシー系拡張機能、社内ネットワークのフィルタなど。
  PCのブラウザで起きやすい）。`firebase` が未定義だと `firebase.initializeApp()` が例外を投げ、
  ここを守らないと「読み込み中…」から一生進まなくなる。`app-core.js` の Firebase init を
  try/catch で囲み、失敗したら `init()`（app-init.js）が `#screen-load-error` に切り替える
  （原因の案内＋再読み込みボタン）

---

## 5. コストを増やさないための決め事

「限りなく0円」で運用する前提。以下はコード側で実施済みなので**壊さない**こと。

| 決め事 | 理由 |
|---|---|
| リマインドは**5分ごと**起動（毎分にしない） | 実行回数 ▲80%。アプリ側の時刻入力も5分きざみに丸めている |
| 全関数のメモリは**128MB** | GB秒消費が半減 |
| 関数リージョンは **`asia-southeast1`**（RTDB と同じ） | リージョン間のデータ転送費をゼロに |
| Cloud Scheduler ジョブは**3つまで** | 無料枠が3ジョブ |
| 完了データは**90日でアーカイブ**（`ARCHIVE_AFTER_DAYS`） | DB肥大を防ぐ |

デプロイのたびに Artifact Registry にイメージが溜まるので、一度だけ設定しておく:

```bash
firebase functions:artifacts:setpolicy --location asia-southeast1
```

予算アラート（Google Cloud Console → お支払い → 予算とアラート）も月100円などで設定推奨。

## 6. 利用者数・コストの確認方法

| 知りたいこと | 見る場所 |
|---|---|
| 実際に使われている人数（一番正確） | Firebase Console → Realtime Database → `families/*/members` の件数を数える。離脱した試用アカウントを含まない |
| 登録アカウント数・最終ログイン日時 | Firebase Console → Authentication → Users |
| 利用状況の推移（DAU/MAU・継続率など） | Firebase Console → Analytics（[`app.html`](../../app.html) が起動時に自動収集。個人を特定しない集計データのみ） |
| Functions呼び出し回数・DB/Storageの転送量 | Firebase Console → 各プロダクトの使用量タブ |
| 実際の請求額 | Google Cloud Console → お支払い |

Analytics は `firebase-config.js` の `measurementId` を使って `app.html` から自動収集している
（`app-core.js` の Firebase init 部分）。広告ブロッカー等で読み込めなくてもアプリ本体の動作には影響しない
（auth/db の初期化とは別に try/catch している）。個人情報の扱いは [`privacy.html`](../../privacy.html) に明記。


## 7. 家族参加の権限修正を公開する前に

このブランチのルールは自動公開されない。現行の Console ルールを先に確認し、既存会員の
`role`/`memberRole` 欠損・矛盾を評価する。旧版で既に作られた不正な会員を新ルールだけで
識別・取り消すことはできない。実データをエミュレータへコピーしない。

公開順序は、(1) 合成ユーザーを使う RTDB エミュレータ試験と旧クライアント互換性の確認、
(2) 招待 Callable のデプロイ、(3) 新クライアントの配信と更新待ち、(4) 現行ルールの控えを
保存してから Console でルール公開、の順とする。旧クライアントは新ルール公開後に
`invites` の読取・書込と直接 membership 作成ができないので、利用者の更新を先に確認する。
既存会員の通常操作は新ルールでも維持する。古い 6 文字コードは、家族の
`meta.inviteCode` と一致する場合だけ Callable で受け付ける。初回利用時に 7 日・最大10人へ制限し、同じ UID による再利用を拒否する。ただし初回利用前の旧コードには期限がないため、保護者が新コードを発行する移行期限を決める。新コードも 7 日・最大10人で、期限切れや初回発行失敗後は設定画面から再発行できる。

切り替え後に、第三者の自己参加・権限注入・複数パス更新の拒否と、保護者・子どもの
通常操作、招待参加を監視する。障害時は保存した直前のルールへ戻せるが、旧ルールの
権限欠陥が再露出するため、暫定対応の期限を決める。本番へのルール公開・関数デプロイ・
会員データの修正はいずれも別途承認して実施する。
