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

### 回帰スイート（スクラッチパッドの Playwright 群）

インメモリの Firebase スタブ（`fb-stub.js`）で家族データを再現して動かす。

| 種類 | 見ているもの |
|---|---|
| `lowstock` / `lowlead` / `bughunt` | ⏳ そろそろ切れるかも（予測・期間指定・×・重複） |
| `circle-toggle` / `bought` | ◯ タップの宣言・取り消し・完了 |
| `history-close` / `hist-footer` | 履歴シートが閉じる・スクロールする |
| `store-footer` | 店内モードの終了ボタン位置 |
| `update` / `update-banner` | 更新バナー・強制更新・強制ログアウト |
| `features` / `dogfood` | 主要導線の通し |

**書くときの注意（過去にハマったもの）**

- Playwright の `page.route` は **Service Worker 発のリクエストを横取りできない**
  → テストサーバー側で gstatic の URL を同一オリジン `/__fb/` に書き換える
- `window.state` は読めない（クラシックスクリプトの `const` は `window` に乗らない）
  → **DOM から検証**する
- カードの出現アニメーション中は要素が "not stable" でクリックできない
  → `addInitScript` で `animation:none` を流し込む
- 「sticky だから見えているはず」で満足しない。**`scrollTop` を実測**する

---

## 3. 作業を終える前

1. `node --check app.js && node --check functions/index.js`
2. 触った領域の回帰スイートを通す（UI を変えたなら全部）
3. `sw.js` の `CACHE` を上げたか
4. デプロイが要る変更なら PR 本文に「デプロイ後にやること」を書いたか（→ `deploy.md`）
5. ドキュメントの更新が要るか（機能を足した → `docs/features.md`、決め事を変えた → `docs/rules/`）

---

## 4. スクリーンショットの撮り直し

`docs/screenshots/` は `docs/features.md` から参照している。UI を変えたら撮り直す。

- 幅 **480px・256色**に最適化してから置く（17枚で 3.3MB → 837KB の実績）
- 固定のボトムナビや FAB が被る場合は、その1枚だけ `visibility:hidden` にして撮る
- **テスト用のサンプルデータで撮る**。実データを混ぜない
