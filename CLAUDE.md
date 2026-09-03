# おうちのおつかい — 作業のとき最初に読むもの

家族で買い物を共有する **PWA 1本**のリポジトリ。
GitHub Pages で配信し、Firebase（Auth / Realtime Database / Storage / FCM / Functions）を使う。

公開URL: https://b-w-hiroki.github.io/otsukai/

---

## 1. 起動時に読む順番（1番から順に・例外なし）

| # | 読むもの | 何のため |
|---|---|---|
| 1 | **この `CLAUDE.md`** | 禁止事項と止まる条件を先に入れる |
| 2 | **[`docs/index.md`](./docs/index.md)** | どこに何があるか・**正本レジストリ** |
| 3 | **[`docs/rules/workflow.md`](./docs/rules/workflow.md)** | ブランチ・テスト・終わる前の確認 |
| 4 | 依頼に応じた**担当ファイル**（下の対応表） | 実作業の判断材料 |
| 5 | 触る対象のコード | — |

@docs/index.md
@docs/rules/workflow.md

3までは**依頼の内容にかかわらず必ず読む**。4以降だけが依頼で変わる。

---

## 2. 依頼の種類 → 先に読む場所

| 依頼が来たら | 先に読む | 主な対象ファイル |
|---|---|---|
| **画面の見た目・ボタン・レイアウト** | [`docs/rules/ui.md`](./docs/rules/ui.md) | `styles.css`, `index.html`, `app-*.js` |
| **機能を足す・変える** | [`docs/features.md`](./docs/features.md) → `docs/rules/ui.md` | `app-*.js`, `index.html` |
| **通知・ポイント・サーバー処理** | [`functions/README.md`](./functions/README.md) → [`docs/rules/deploy.md`](./docs/rules/deploy.md) | `functions/index.js` |
| **DBの構造・権限** | [`docs/rules/deploy.md` §2](./docs/rules/deploy.md) | `database.rules.json` |
| **リリース・更新が届かない** | [`docs/rules/deploy.md`](./docs/rules/deploy.md) | `sw.js`, `manifest.json` |
| **広告・収益化** | [`docs/monetization-ideas.md`](./docs/monetization-ideas.md) | `app-init.js` の `initAdSlots()` |
| **ストア配信（Android/iOS）** | [`docs/release-plan.md`](./docs/release-plan.md) | — |
| **バナー・宣伝素材** | [`docs/banner-prompt.md`](./docs/banner-prompt.md) | — |
| **使い方の説明・スクショ** | [`docs/features.md`](./docs/features.md) → [`workflow.md` §4](./docs/rules/workflow.md) | `docs/screenshots/` |

---

## 3. やってはいけないこと

**コード**

- ❌ `styles.css` 以外に**色を hex で直書き**する（ダークモードが破綻する。CSS変数を使う）
- ❌ グローバル `button` を上書きせずに独自ボタンを作る（白背景に白文字で文字が消える）
- ❌ `.sheet` の構造（`sheet-content` + `sheet-footer`）から外れたシートを作る（長い中身で閉じられなくなる）
- ❌ Service Worker の `install` で `skipWaiting()` を呼ぶ（入力中に勝手にリロードされる）
- ❌ `cache.addAll` を使う（1つ失敗すると SW ごと入らない）
- ❌ タップ領域を 44×44px 未満にする
- ❌ 破壊的操作（削除・リセット）を `confirm` なし、またはトグルの外に置く

**リリース**

- ❌ `sw.js` の `CACHE` を上げずにリリースする（利用者に届かない）
- ❌ `firebase.json` に `database` や `hosting` を足す（既存ルールと GitHub Pages を壊す）
- ❌ Cloud Scheduler ジョブを4つ以上にする / 関数のメモリやリージョンを変える（課金が増える）

**Git**

- ❌ `master` に直接コミット・直接プッシュする
- ❌ マージ済みの PR を再利用する（`master` から切り直して新しい PR にする）
- ❌ ドラフトでない PR を勝手に作る／自分で ready にする／自分でマージする

**ドキュメント**

- ❌ 同じ事実を2箇所に書く（→ [`docs/index.md` の正本レジストリ](./docs/index.md#正本レジストリ)に従う）
- ❌ `hub.html` から参照されている `docs/*.md` をリネーム・移動する（リンクが切れる）
- ❌ スクショに実データを写す

---

## 4. 止まって確認をとる条件

次に当てはまったら、**手を止めて聞く**。勝手に進めない。

1. **課金が発生・増加する**変更（Blaze・Scheduler ジョブ追加・関数のメモリやリージョン変更）
2. **データが消える / 戻せない**操作（DBの削除、`archive/` の掃除、force push）
3. **DBルールの権限を緩める**変更（読み書きできる範囲が広がるもの）
4. **依頼の読み方が2通り以上**あって、どちらかで作るものが変わるとき
   - 例:「期間を指定可能に」→ 全体のしきい値か、品目ごとの値か
5. **外に出る**もの（PR を ready にする、ストア申請、公開URLの変更、第三者サービスへの送信）
6. 既存の決め事（このファイルや `docs/rules/`）を**破る必要がある**と判断したとき

逆に、**確認せずに進めてよい**もの: 実装方針の選択、テストの書き方、コミットの粒度、
ドキュメントの文面、既存ルールの範囲内のリファクタ。

---

## 5. 作業完了前のチェックリスト

上から順に。1つでも落ちたら完了と言わない。

- [ ] `for f in app-*.js; do node --check "$f"; done && node --check functions/index.js` が通る
- [ ] `database.rules.json` を触ったなら JSON として妥当
- [ ] `node tests/run-all.mjs` が通る（UI を変えたなら全部・約2分）
- [ ] ドキュメントを触ったなら `node tests/docs-check.mjs` が通る
- [ ] `sw.js` の `CACHE` を上げた
- [ ] UI を変えたなら `docs/screenshots/` を撮り直した（480px・256色に最適化）
- [ ] 機能を足したなら `docs/features.md` を更新した
- [ ] 決め事を変えたなら `docs/rules/` を更新し、**正本レジストリと矛盾していない**
- [ ] ブランチを切ってコミットし、**ドラフト PR** を作った
- [ ] PR 本文に「**デプロイ後にやること**」を書いた（functions / DBルールを触ったなら必須）
- [ ] CI（`syntax` / `docs` / `smoke` / `regression`）がグリーン
- [ ] 落ちたテスト・やらなかったことがあれば、**隠さず報告した**

---

## 6. このリポジトリの前提（覚えておくこと）

- **アプリ本体はルート直下にフラット配置**（`app.html` / `app-*.js` / `styles.css` / `sw.js`）。
  移動するとキャッシュ・PWA・GitHub Pages の配信パスが全部ずれるので動かさない
- **ルートの `index.html` は紹介ページ（ランディングページ）**で、アプリ本体ではない。
  広告の媒体審査やSNSからの訪問者向けに、ログイン不要で内容が読める静的ページ。
  PWAとして起動されたとき・`?action=` 付きで開かれたときは `app.html` へ即リダイレクトする
  （インストール済みPWAの起動URLは `./` のままのため）。アプリを開くリンクは `./app.html` に向ける
- **`app.js` は機能ごとに10ファイルへ分割済み**（`app-core.js` から `app-init.js` まで）。
  すべてクラシックスクリプトでグローバルスコープを共有しており、`index.html` の
  `<script>` の並び順で読み込み順が保証される（**順序を変えない**。特に `app-init.js`
  が持つ `init()` 呼び出しは最後に読み込まれる前提）
- `hub.html` は**プロジェクトハブ**（メインアプリ / 旧版 v1 / ドキュメント / ロードマップへの入口）
- `app.v1.html` は**旧バージョンの保存**。触らない
- サーバーは **`asia-southeast1`**、RTDB と同じリージョンに揃えてある
- **`firebase deploy` では DB ルールが反映されない**。Console から手で貼る
