# 作業の進め方のルール

ブランチ・テスト・PR の決め事。**手を動かす前と、終わる前に見る。**

---

## 1. ブランチと PR

- 作業は**必ずブランチを切る**。`master` に直接コミットしない
- PR は**ドラフトで作る**。ready にするのもマージするのも人がやる
- **マージ済みの PR は再利用しない**。追わせる変更は `master` から切り直して新しい PR にする

```bash
git fetch origin master
git checkout -B <branch> origin/master   # マージ済みなら切り直し
git push -u origin <branch>
```

---

## 2. テスト

CI（`.github/workflows/check.yml`）は2ジョブ:

| ジョブ | 内容 |
|---|---|
| `syntax` | JS構文 / インラインスクリプト / JSON妥当性 / `sw.js` のプリキャッシュ対象が存在するか |
| `smoke` | Playwright で起動・認証画面表示・未捕捉エラーゼロ（`tests/smoke.mjs`） |

CI は**最低限**しか見ない。UI を触ったら**手元の回帰スイート**も通す。

### 回帰スイート（`tests/regression/` の22本）

インメモリの Firebase スタブ（`tests/fb-stub.js`）で家族データを再現して動かす。
本物の Firebase には一切つながないので、オフラインでも走る。

```bash
node tests/run-all.mjs            # 全部（約2分）
node tests/run-all.mjs lowstock   # 名前に含むものだけ
node tests/regression/bughunt.mjs # 1本だけ
```

| ファイル | 見ているもの |
|---|---|
| `lowstock-test` / `lowlead-test` / `bughunt` | ⏳ そろそろ切れるかも（予測・期間指定・×・重複・異常値） |
| `circle-toggle-test` / `bought-test` | ◯ タップの宣言・取り消し・完了 |
| `history-close-test` / `hist-footer-test` | 履歴シートが閉じる・実タッチでスクロールする |
| `store-footer-test` | 店内モードの終了ボタン位置 |
| `shortcut-tab-test` | ⚡よく買うものタブ（下部ナビ）・カード/リスト表示切替・写真の登録と編集モードでの差し替え・品名からの連想イラスト・大量件数のスクロール |
| `shortcut-sheet-test` | お買い物ページのフローティングボタン（⚡よく買う）から開く簡易シート・表示切替の共有 |
| `shortcut-confirm-test` | カードタップ時の確認ダイアログ（品名の表示・キャンセルで未追加） |
| `tab-swipe-test` | ページ内タブ（お買い物/よく買うもの/支出/ストック/設定）の左右スワイプ切替・端での折り返し無し・シート/店内モード中の抑止・下部ナビの背景が指に追従して滑る／閾値未満なら元へ戻る |
| `update-test` / `update-banner-test` | 更新バナー・強制更新・強制ログアウト・引っ張って更新 |
| `photo-test` | 📷 写真の添付・表示・拡大・外す・店内モードのサムネイル |
| `icon-picker-test` | 🎨 イラストから選ぶピッカー（おつかい/よく買うもの/ストックの写真欄で共通） |
| `expense-log-test` | 💴 支出・家計タブでの記録・削除・レシートOCR（読み取り成功/失敗の両方） |
| `features-test` | 主要導線の通し |

**共通処理は `tests/harness.mjs` に集約**している。各テストは3行で始まる:

```js
import { startHarness } from "../harness.mjs";
const t = await startHarness();          // label / noAnimation / dialogAction / transform
const { page, sleep, OUT } = t;
```

ハーネスが用意するもの: テストサーバー / ブラウザ（390×844・タッチ有効）/ `check()` /
`t.swipeUp()` `t.swipeDown()` `t.swipeLeft()` `t.swipeRight()`（CDP の実タッチ）/ `t.dialogs` / `t.finish()`。

**書くときの注意（過去にハマったもの）**

- Playwright の `page.route` は **Service Worker 発のリクエストを横取りできない**
  → ハーネスがテストサーバー側で gstatic の URL を同一オリジン `/__fb/` に書き換えている。
    新しいテストで `page.route` を使い直さないこと
- `window.state` は読めない（クラシックスクリプトの `const` は `window` に乗らない）
  → **DOM から検証**する
- カードの出現アニメーション中は要素が "not stable" でクリックできない
  → `startHarness({ noAnimation: true })`
- 「sticky だから見えているはず」で満足しない。**`scrollTop` を実測**する。
  マウスホイールでは慣性スクロールを再現できないので `t.swipeUp()` を使う

---

### ドキュメントの自動チェック

```bash
node tests/docs-check.mjs
```

リンク切れ・`@`インポート・HTML からの参照・**二重管理**・正本レジストリの実在・
`CLAUDE.md` の必須節を見る。CI の `docs` ジョブでも走る。

> 二重管理の検出は**地の文だけ**が対象。表の行は「| ボタン | 用途 |」のような
> 共通ヘッダで誤検知するため除外している。表の重複は人の目で見る。

---

## 3. 作業を終える前

1. `for f in app-*.js; do node --check "$f"; done && node --check functions/index.js`
2. 触った領域の回帰スイートを通す（UI を変えたなら全部）
3. `sw.js` の `CACHE` を上げたか
4. デプロイが要る変更なら PR 本文に「デプロイ後にやること」を書いたか（→ `deploy.md`）
5. ドキュメントの更新が要るか（機能を足した → `docs/features.md`、決め事を変えた → `docs/rules/`）

---

## 4. スクリーンショットの撮り直し

`docs/screenshots/` は `docs/features.md` から参照している。UI を変えたら撮り直す。

```bash
node tests/capture-docs.mjs   # 18枚をまとめて撮り直す
```

- 幅 **480px・256色**に最適化してから置く（18枚で 3.3MB → 900KB前後の実績）
- 固定のボトムナビや FAB が被る場合は、その1枚だけ `visibility:hidden` にして撮る
- **テスト用のサンプルデータで撮る**。実データを混ぜない
