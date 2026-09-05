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
| **お知らせ（アップデート履歴）の内容** | `news.js`（先頭に1件足す） | `news.html`（表示だけ）・設定タブのバッジ |
| **利用規約** | `terms.html` | — |
| **プライバシーポリシー** | `privacy.html` | — |
| **お問い合わせ** | `contact.html` | — |

**粒度が違うものは、無理に片方へ寄せない。** 通知・更新・使い方は正本が2つある:

| 話題 | 利用者から見た情報 | 開発者から見た情報 |
|---|---|---|
| 通知 | `features.md` §10（いつ・何が・誰に届くか） | `functions/README.md`（どの関数が送るか） |
| 更新 | `features.md` §9（どのボタンをいつ押すか） | `rules/deploy.md` §4（なぜ3段構えか・SWの落とし穴） |
| 使い方 | `guide.html`（アプリ内から開く、平易な説明） | `docs/features.md`（機能仕様13章・スクショ付き） |

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
| [`features.md`](./features.md) | 機能仕様13章（利用者向け・スクショ18枚） | 機能追加のたび更新 |
| [`../functions/README.md`](../functions/README.md) | 関数10個の責務・仕組み図・VAPID/Blaze/メール通知の設定 | 関数追加のたび更新 |
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
| アプリ本体 | **ルート直下**（`app.html` / `app-*.js`（機能ごとに10分割） / `styles.css` / `sw.js`） | 動かさない。移動するとPWAの配信パスが壊れる |
| 紹介ページ（LP） | **ルート直下の `index.html`** | ログイン不要で読める静的ページ。PWA起動時は `app.html` へ転送 |
| よく買うものの連想イラスト | `shortcut-icons/` | 英語名.svg（`app-requests.js` の `ICON_LIBRARY` に1行足して参照。ピッカーの一覧と品名からの自動判定の両方に使われる） |
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
| 📣 お知らせに1件足す | `news.js` の先頭に追記（書き方はファイル冒頭のコメント）→ [`rules/deploy.md` §1](./rules/deploy.md) |
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
| **ルート直下** | 紹介ページ＋アプリ本体（PWA） | `index.html`（紹介）→ `app.html` → `app-core.js`（読み込み順は `app.html` の `<script>` 参照） |
| `docs/` | ドキュメント一式 | **このファイル** |
| `docs/rules/` | 決め事 | `ui.md` / `deploy.md` / `workflow.md` |
| `docs/screenshots/` | 説明用スクショ18枚 | `features.md` から参照 |
| `functions/` | Cloud Functions（通知・ポイント・アーカイブ） | `README.md` → `index.js` |
| `tests/` | スモーク＋回帰スイート＋ドキュメント検査 | `run-all.mjs` / `docs-check.mjs` |
| `tests/regression/` | 回帰テスト26本 | `harness.mjs` から始まる |
| `.github/workflows/` | CI 定義 | `check.yml` |

**HTML の入口**

| ファイル | 役割 |
|---|---|
| `index.html` | 紹介ページ（ランディングページ）。ログイン不要。PWA起動時は `app.html` へ転送 |
| `app.html` | アプリ本体（ログイン画面から始まる） |
| `hub.html` | プロジェクトハブ（メインアプリ / 旧版 / ドキュメント / ロードマップ） |
| `guide.html` | 使い方ガイド（利用者向け・平易な説明） |
| `news.html` | 📣 お知らせ（アップデート履歴）。`news.js` を読んで日付の新しい順に一覧表示。アプリの設定タブと紹介ページのフッターから開く |
| `terms.html` | 利用規約 |
| `privacy.html` | プライバシーポリシー（ストア申請に必須） |
| `contact.html` | お問い合わせフォーム（Cloud Functions `submitContactForm` 経由で記録＋メール通知） |
| `app.v1.html` | 旧バージョンの保存。**触らない** |

---

## 未完了の宿題（コードの外でやること）

| # | やること | 書いてある場所 |
|---|---|---|
| 4 | 予算アラート（月100円など）の設定 | [`rules/deploy.md` §5](./rules/deploy.md) |
| 6 | 通知タップで `app.html` を開く変更（`functions/index.js`）を反映する `firebase deploy --only functions`（急ぎではない） | [`rules/deploy.md` §3](./rules/deploy.md) |
| 7 | i-mobile の媒体審査を紹介ページの URL（`https://otsukai.birdman-studio.com/`）で再申請 | [`monetization-ideas.md`](./monetization-ideas.md) |

済み（2026-09-03）: functions 初回デプロイ（Node 22）、コンテナイメージの削除ポリシー（1日）、
お問い合わせメール通知の Secret Manager 登録と到達確認。
