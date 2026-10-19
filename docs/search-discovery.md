# 検索公開範囲と測定手順

## 公開範囲

- 検索対象は紹介ページ `/`、使い方 `/guide.html`、お知らせ一覧 `/news.html`、プライバシーポリシー、利用規約に限定する。
- 認証から始まる `/app.html`、旧版 `/app.v1.html`、開発者向け `/hub.html` は `noindex` で除外する。クローラーが `noindex` を読めるよう、この3ページ自体は `robots.txt` で遮断しない。
- 招待・起動パラメータ付き URL は sitemap に含めず、紹介ページの canonical は常にルートへ正規化する。共有リンクのプレビューと `noindex` の読取を妨げないよう、公開 HTML 自体は `robots.txt` で遮断しない。
- `robots.txt` はアクセス制御ではないため、個人情報や秘密を公開ファイルへ置かない。

## 比較可能な測定

UTC 日時と実行環境を記録し、公開後に次を実行する。

```sh
curl -sS -D headers.txt -o index.html https://otsukai.birdman-studio.com/
curl -sS -D robots-headers.txt -o robots.txt https://otsukai.birdman-studio.com/robots.txt
curl -sS -D sitemap-headers.txt -o sitemap.xml https://otsukai.birdman-studio.com/sitemap.xml
node tests/search-discovery.mjs
```

HTML では title、description、canonical、OG、JSON-LD を確認する。HTTP status、最終 URL、`content-type`、取得時刻を保存する。検索結果の観測は検索エンジン名、検索語、UTC 日時、ログイン状態を併記する。順位や AI 検索での引用は変動するため保証値にしない。

ブラウザ表示は Chromium の 390×844 CSS px で紹介ページを撮影し、横スクロール、見出し、主 CTA、先頭スクリーンショットを確認する。再現例:

```sh
npx playwright screenshot --viewport-size="390,844" https://otsukai.birdman-studio.com/ otsukai-home.png
```

## 変更前の観測

- 2026-10-19 12:29 UTC、直接 HTTP 取得: `/` は 200 で description、canonical、OG、静的紹介あり。
- 同時刻、`/robots.txt` と `/sitemap.xml` は 404。
- 2026-10-19 12:48 UTC、Bing 通常検索（未ログイン相当の HTTP 取得、`site:otsukai.birdman-studio.com`）: 返却された上位 organic 結果ブロックに対象ドメインの一致を確認できなかった。これはインデックス未登録の確定判定ではなく、地域・時刻・検索側の応答に依存する観測値。
- 2026-10-19 12:29 UTC、`birdman-studio.com` apex は A / AAAA / CNAME が無く名前解決不能。直前調査の 503 は再現せず、コードではなく DNS / hosting 側の確認が必要。サブドメインは `b-w-hiroki.github.io` への CNAME で 200。
- 2026-10-19 12:38 UTC、Chromium 390×844 で変更後のローカル紹介ページを撮影し、見出し、主 CTA、画面イメージを確認。既存 `brand-site-link-test` の横 overflow 検査も通過。
- ChatGPT、Gemini、Copilot への質問や外部 AI API 送信は実施していない。

## 自動契約検査とJSON記録

- node tests/search-discovery.mjs は sitemap の canonical 一致、掲載HTMLから参照する同一オリジンの href/src 実在、OG画像の実ファイルと1200×630寸法を検査する。
- 2026-10-19 14:24 UTC、og.jpg を実ピクセルで確認し、「おうちのおつかい」の名称・買い物リスト画面・説明文が読め、端の見切れがないことを確認した。
- 公開前後は次の同一コマンドを実行し、標準出力のJSONを docs/qa/search-discovery/YYYY-MM-DD-http.json として保存する。

    node scripts/measure-search-discovery.mjs https://otsukai.birdman-studio.com/

JSONはUTC時刻、要求URL、最終URL、status、content-type、バイト数、title、description、canonical、OG画像、sitemap URL数を同じキーで出力する。ローカル確認では公開URLの代わりにローカルサーバーのURLを渡す。
