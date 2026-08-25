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

関数ごとの責務は `functions/README.md` を参照。

---

## 4. PWA の更新が届く仕組み（3段構え）

PWA は `app-*.js` / `styles.css` をキャッシュ優先で配信するため、放置すると古い版で固定される。
そのため次の3段構えを入れている。

1. **自動検知＋自動適用** — 新バージョンを検知したら上部にバナーを出し、かつ**操作の邪魔にならない
   安全なタイミング**（シート/モーダルが何も開いておらず、入力欄にフォーカスも無く、画面が
   見えている）になり次第、数秒おきに見に行って自動で切り替える。バナーの「今すぐ更新」で
   即時にもできる（`isSafeToAutoUpdate()` / `scheduleAutoApply()`、app-init.js）
2. **定期チェック** — 起動時・アプリに戻ったとき・1時間ごと（`updateViaCache: "none"`）
3. **手動復旧** — 設定 → 🔧 メンテナンス
   - 🔄 データを再読み込み（SWの更新チェック。家族データは既にリアルタイム同期済みのため
     リスナーは張り直さない — 張り直すと全サブツリーの無駄な再取得になる）
   - ⬇️ アプリを最新版に更新（全キャッシュ破棄）
   - 🚪 強制ログアウト（端末の設定もリセット）

加えて、ホーム画面を**下に引っ張ると更新**（pull-to-refresh）できる。

### 実装上の落とし穴（過去に踏んだもの）

- `install` で `skipWaiting()` を**呼ばない**。呼ぶと入力中に勝手にリロードされる
- 同じ理由で、**自動適用も無条件にはしない**。`isSafeToAutoUpdate()` の条件（シート/モーダル
  未使用・入力欄フォーカス無し・画面が見えている）を必ず経由すること
- `cache.addAll` は1つ失敗すると全体が失敗し SW ごと入らない → **個別に `cache.add` + try/catch**
- `controllerchange` は初回インストールでも発火する → `updateRequested` と `hadControllerAtStart` で守る
- HTMLはネットワーク優先・JSはキャッシュ優先なので、デプロイ直後は「新HTML＋更新前の古いJS」
  が一時的に混在する（SWが切り替わるまで数十分〜1時間）。この間に古いJSが新HTMLに無い要素を
  `$(id)` で参照すると例外になり、`init()` がそこで丸ごと止まって**画面が真っ白のまま進まなく
  なる**（実際に発生した障害。`wireGlobalEvents()` 等はこのため個別に try/catch で守っている）。
  HTML側の要素IDを消す・変えるときは、この移行期間があることを踏まえる

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
