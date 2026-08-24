# 索引 — どこに何があるか

ルートの [`CLAUDE.md`](../CLAUDE.md) から最初に飛んでくる場所。
**「これはどこに書けばいい？」「これの正しい版はどれ？」に答える1枚。**

---

## 正本レジストリ

同じ話が2箇所にあるとき、**どちらが正しいか**の表。
書き換えるときは**正本だけ**を直し、もう片方はリンクにする。

| 話題 | 正本 | 参照だけ（実体を持たない） |
|---|---|---|
| **色・トークン** | `styles.css` の CSS 変数 | `docs/banner-prompt.md` ブランド設定 |
| **ボタン配置・クラス・シート構造** | `docs/rules/ui.md` | — |
| **PWA更新の仕組み・SWの落とし穴** | `docs/rules/deploy.md` §4 | `docs/rules/ui.md` §6 |
| **更新のやり方（利用者の操作）** | `docs/features.md` §9 メンテナンス | — |
| **DBルールの適用手順** | `docs/rules/deploy.md` §2 | `functions/README.md` §3 |
| **functions のデプロイ手順** | `docs/rules/deploy.md` §3 | `functions/README.md` デプロイ手順 |
| **Firebase の運用コスト** | `docs/rules/deploy.md` §5 | `functions/README.md` 末尾 |
| **サーバー関数の責務** | `functions/README.md` 含まれる関数 | — |
| **通知の内容（利用者視点）** | `docs/features.md` §10 | — |
| **通知の実装（どの関数が送るか）** | `functions/README.md` | `docs/features.md` §10 の注記 |
| **i-mobile の PID/asid・残タスク** | `docs/monetization-ideas.md` | `docs/release-plan.md` i-mobile 節 |
| **ストア配信の費用と手順** | `docs/release-plan.md` | — |
| **ブランチ・テスト・PR の進め方** | `docs/rules/workflow.md` | — |
| **機能の仕様（利用者向け）** | `docs/features.md` | — |

**粒度が違うものは、無理に片方へ寄せない。** 通知と更新は正本が2つある:

| 話題 | 利用者から見た情報 | 開発者から見た情報 |
|---|---|---|
| 通知 | `features.md` §10（いつ・何が・誰に届くか） | `functions/README.md`（どの関数が送るか） |
| 更新 | `features.md` §9（どのボタンをいつ押すか） | `rules/deploy.md` §4（なぜ3段構えか・SWの落とし穴） |

寄せると片方が使えなくなるため、あえて分けている。ただし**足すときは両方直す**。

---

## 4分類で見た全ファイル

### 🧭 Rule — 判断軸・決め事

| ファイル | 何を決めているか |
|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | 読む順番・依頼別の対応表・禁止事項・止まる条件・完了前チェック |
| [`rules/ui.md`](./rules/ui.md) | ボタン配置5原則 / ボタンのクラス / 44pxタップ領域 / 色はCSS変数のみ / シート構造 |
| [`rules/deploy.md`](./rules/deploy.md) | リリース時の必須5項目 / DBルールの手動適用 / functionsデプロイ / PWA更新の仕組み / コストの前提 |
| [`rules/workflow.md`](./rules/workflow.md) | ブランチとPR / CIと回帰スイート / テストの落とし穴 / スクショの撮り方 |

### 📚 Knowledge — 変わらない事実・情報の正本

| ファイル | 中身 | 鮮度 |
|---|---|---|
| [`features.md`](./features.md) | 機能仕様12章（利用者向け・スクショ17枚） | 機能追加のたび更新 |
| [`../functions/README.md`](../functions/README.md) | 関数9つの責務・仕組み図・VAPID/Blaze の設定 | 関数追加のたび更新 |
| [`release-plan.md`](./release-plan.md) | ストア配信 Phase 0/1/2・費用表 | **金額は2026年7月時点**（Play $25 / Apple $99・年） |
| [`monetization-ideas.md`](./monetization-ideas.md) | 広告配置案・i-mobile の PID/asid 実値・残タスク | 配置変更のたび更新 |

**コードの中にある事実**（ドキュメントに写さない。ここを見る）

| 知りたいこと | 見る場所 |
|---|---|
| DBの構造と権限 | `database.rules.json` |
| Firebase プロジェクトID | `.firebaserc`（`otsukai-app-4b62b`） |
| 色・余白・角丸のトークン | `styles.css` 冒頭の `:root` |
| 現在のキャッシュ版 | `sw.js` の `CACHE` |
| アーカイブ保持日数 | `functions/index.js` の `ARCHIVE_AFTER_DAYS`（既定90日） |

### 📦 Output — 成果物の置き場

| 成果物 | 置き場 | 名前の付け方 |
|---|---|---|
| アプリ本体 | **ルート直下**（`index.html` / `app-*.js`（機能ごとに10分割） / `styles.css` / `sw.js`） | 動かさない。移動するとPWAの配信パスが壊れる |
| よく買うものの連想イラスト | `shortcut-icons/` | 英語名.svg（`app-requests.js` の `SHORTCUT_ICON_MATCH` から参照） |
| 説明用スクショ | `docs/screenshots/` | `NN-名前.png`（連番・480px幅・256色） |
| ドキュメント | `docs/` | 小文字ハイフン区切り。`hub.html` から参照されているものはリネーム禁止 |
| ルール | `docs/rules/` | 小文字1語（`ui` / `deploy` / `workflow`） |
| 変更の提出先 | GitHub の**ドラフトPR** | 本文に「デプロイ後にやること」を必ず書く |
| 回帰テスト | `tests/regression/` | `NN-名前.mjs` ではなく `〜-test.mjs`。共通処理は `tests/harness.mjs` |
| テストのスクショ出力 | `tests/shots/`（gitignore 済み） | — |
| 使い捨ての調査スクリプト | スクラッチパッド（リポジトリに入れない） | — |

### 🔁 Skill — 繰り返す作業の手順

| やること | 手順の場所 |
|---|---|
| リリースする | [`rules/deploy.md` §1](./rules/deploy.md) |
| DBルールを適用する | [`rules/deploy.md` §2](./rules/deploy.md) |
| functions をデプロイする | [`rules/deploy.md` §3](./rules/deploy.md) |
| 回帰テストを回す | `node tests/run-all.mjs` → [`rules/workflow.md` §2](./rules/workflow.md) |
| ドキュメントの整合を確かめる | `node tests/docs-check.mjs` |
| スクショを撮り直す | `node tests/capture-docs.mjs` → [`rules/workflow.md` §4](./rules/workflow.md) |
| バナー画像を作る | [`banner-prompt.md`](./banner-prompt.md) |
| Android/iOS に出す | [`release-plan.md`](./release-plan.md) |

---

## フォルダの役割と入口

| 場所 | 役割 | 入口 |
|---|---|---|
| **ルート直下** | アプリ本体（PWA） | `index.html` → `app-core.js`（読み込み順は `index.html` の `<script>` 参照） |
| `docs/` | ドキュメント一式 | **このファイル** |
| `docs/rules/` | 決め事 | `ui.md` / `deploy.md` / `workflow.md` |
| `docs/screenshots/` | 説明用スクショ17枚 | `features.md` から参照 |
| `functions/` | Cloud Functions（通知・ポイント・アーカイブ） | `README.md` → `index.js` |
| `tests/` | スモーク＋回帰スイート＋ドキュメント検査 | `run-all.mjs` / `docs-check.mjs` |
| `tests/regression/` | 回帰テスト12本 | `harness.mjs` から始まる |
| `.github/workflows/` | CI 定義 | `check.yml` |

**HTML の入口**

| ファイル | 役割 |
|---|---|
| `index.html` | アプリ本体 |
| `hub.html` | プロジェクトハブ（メインアプリ / 旧版 / ドキュメント / ロードマップ） |
| `privacy.html` | プライバシーポリシー（ストア申請に必須） |
| `app.v1.html` | 旧バージョンの保存。**触らない** |

---

## 未完了の宿題（コードの外でやること）

| # | やること | 書いてある場所 |
|---|---|---|
| 1 | Firebase Console に `database.rules.json` を適用（`settings` の追加分） | [`rules/deploy.md` §2](./rules/deploy.md) |
| 1b | **Storage のルールで `families/{familyId}/requests/` を許可**（おつかいの写真） | [`rules/deploy.md` §2](./rules/deploy.md) |
| 1c | Firebase Console に `database.rules.json` を再適用（`extraExpenses` の追加分） | [`rules/deploy.md` §2](./rules/deploy.md) |
| 2 | `firebase deploy --only functions` | [`rules/deploy.md` §3](./rules/deploy.md) |
| 3 | `firebase functions:artifacts:setpolicy --location asia-southeast1` | [`rules/deploy.md` §5](./rules/deploy.md) |
| 4 | 予算アラート（月100円など）の設定 | [`rules/deploy.md` §5](./rules/deploy.md) |
| 5 | i-mobile 管理画面でアダルト等のカテゴリ除外 | [`monetization-ideas.md`](./monetization-ideas.md) |
