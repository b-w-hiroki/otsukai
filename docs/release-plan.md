# Android / iOS リリース計画 — コスト最小ルート

> おうちのおつかい(PWA)を Android / iOS でストア配信する際の手順・コスト整理。
> **「お金をかけず段階的に進める」**ことを最優先で構成。

---

## 結論:推奨ルート

```
Phase 0: PWA のまま(現状) → 0円
   ↓ ユーザーが増えてきたら
Phase 1: Android (Play Store) リリース → ¥3,800(一括のみ)
   ↓ Android で収益・反応が出たら
Phase 2: iOS (App Store) リリース → ¥15,000/年 + Mac 必要
```

iOS は **Apple Developer Program が年 $99(約 15,000 円)継続コスト**なので、Android で「払う価値ある」と確認できてから踏み出すのが安全。

---

## リリース方式の選択肢

| 方式 | Android | iOS | コスト | 同期難度 |
|------|---------|-----|--------|---------|
| **PWA のまま**(ストア掲載なし) | ◯ ホーム追加 | △ Safari 限定 | 0円 | ✅ 同コード |
| **TWA / Capacitor**(現PWAを薄いラップ) | ◎ Play 配信 | ◎ App Store 配信 | 後述 | ✅ 同コード |
| 完全ネイティブ書き換え | ◎ | ◎ | 数十万〜 | ❌ 別管理 |

**TWA / Capacitor 方式**を採用すれば、今のコードをそのまま使ってストア配信できる。

---

## Phase 0: PWA のまま(現状・無料)

すでに完了している状態:
- `index.html` + `manifest.json` + `sw.js` で PWA 化済み
- GitHub Pages で配信(無料)
- ユーザーは **Safari/Chrome から「ホーム画面に追加」**でインストールできる

### このフェーズで出来ること
- 知人・家族にURLを共有して試してもらう
- 反応を見る、改善する
- お金は一切かからない

### このフェーズの限界
- 一般ユーザーにはストア検索が主流 → 認知の壁
- iOS Safari の PWA は機能制約あり(プッシュ通知が iOS 16.4+ のみ、ホーム画面追加が必須)
- アプリらしさ(ロゴ・スプラッシュ・通知)が弱い

---

## Phase 1: Android(Google Play)リリース

### 必要費用
| 項目 | 金額 |
|------|------|
| Google Play Console 登録 | **$25(約 3,800 円)** ※ 一括 / 永久ライセンス |
| 開発作業 | 0 円(全部無料ツールで完結) |
| **合計** | **約 3,800 円(初回のみ)** |

### 手順
1. **Play Console アカウント作成**
   - https://play.google.com/console → Google アカウントで登録
   - $25 を支払う(クレカ)
   - 個人なら本人確認のみ。法人は D-U-N-S 番号必要(無料取得可・時間かかる)
2. **TWA パッケージ生成 — PWABuilder で1分**
   - https://www.pwabuilder.com/ にPWAのURLを入力
   - スコアを見て Manifest / Service Worker / Security の項目を緑にする
   - 「Package for Stores」→ Android → ダウンロード(AAB ファイルと署名鍵が生成される)
   - **署名鍵 (`.keystore`) は厳重保管!失うとアップデート不可。**
3. **Digital Asset Links 設定**(必須)
   - PWABuilder が `assetlinks.json` を自動生成
   - これを PWA のドメイン直下に配置: `https://b-w-hiroki.github.io/.well-known/assetlinks.json`
   - GitHub Pages では `.well-known/assetlinks.json` をリポジトリのルートに置く
   - ※ ユーザーディレクトリ配下 (`/otsukai/`) ではなくドメインルートに置く必要があるので、独自ドメインか別リポジトリ運用が必要になる場合あり
4. **ストア掲載情報を準備**
   - アプリアイコン(512×512 PNG)
   - フィーチャーグラフィック(1024×500 PNG)
   - スクリーンショット(2〜8枚、推奨 1080×1920 縦)
   - 短い説明(80文字以内)
   - 詳細な説明(4000文字以内)
   - プライバシーポリシー URL(後述)
5. **データセーフティ申告**
   - Firebase 認証 → メール/Google ID 収集
   - Realtime Database → ユーザー生成データ
   - i-mobile 広告 → 第三者 SDK 開示
6. **AAB アップロード → 内部テスト → 製品版申請**
   - 審査: 通常 1〜3 日(初回はもう少しかかる)

### Phase 1 を始める前に必要なもの
- [ ] 独自ドメイン or `.well-known/assetlinks.json` の配置方法確定
- [ ] プライバシーポリシー作成 + ホスティング(後述・無料)
- [ ] アイコン高解像度版(現状 512px はあるが Play 用に再確認)
- [ ] スクリーンショット 2〜5枚

---

## Phase 2: iOS(App Store)リリース

### 必要費用
| 項目 | 金額 | 備考 |
|------|------|------|
| Apple Developer Program | **$99/年(約 15,000 円)** | 退会するまで毎年継続 |
| Mac(無い場合) | 中古 Mac mini **約 50,000 円** / MacInCloud **月 $30** | iOS ビルドに必須 |
| 開発作業 | 0 円 | Xcode + Capacitor は無料 |

### コスト最小化のコツ
- **Macが無い場合は MacInCloud 月契約**(申請月だけ契約 → $30)。年に一度の更新時のみ契約すれば年 $60 程度で済む
- 退会するとアプリは数日で公開停止 → Phase 1 で確実な収益が出るまで保留

### 手順
1. **Apple Developer Program 登録**
   - https://developer.apple.com/ → $99 支払い
   - 個人なら数日、法人は D-U-N-S 必要
2. **Xcode + Capacitor セットアップ**(Mac 上で)
   ```bash
   npm init -y
   npm i -D @capacitor/cli @capacitor/core @capacitor/ios
   npx cap init "おうちのおつかい" "com.example.otsukai" --web-dir="."
   npx cap add ios
   npx cap open ios
   ```
3. **Xcode でビルド設定**
   - Bundle Identifier 設定
   - Signing & Capabilities → Apple Developer アカウント紐付け
   - アイコン(1024×1024 ほか各種解像度)を Assets.xcassets に登録
4. **App Store Connect でアプリレコード作成**
   - スクリーンショット: iPhone 6.7" / 6.5" / 5.5" の3サイズ必須
   - 説明文、プライバシーポリシーURL、サポートURL
5. **App Privacy 申告**
   - 認証情報、UGC、広告SDKを開示
6. **TestFlight でテスト** → 本番審査(通常 1〜3 日、初回 1 週間ほど)

### iOS PWA → ネイティブ化のメリット
- プッシュ通知が安定して使える(PWA だと iOS 16.4+ 限定 + ホーム追加必須)
- バックグラウンド処理の制約緩和
- アプリ内課金が使える(将来的にサブスク導入する場合)

---

## このアプリ特有の注意点

### 子ども要素(ミッション機能)
- **Apple**: 「キッズ」カテゴリは広告大幅制限(リワード型 OK、ターゲティング広告 NG)
- **Google**: 「**Designed for Families**」プログラム参加可否を判断 → 参加すると審査厳格化
- **対応**: メインカテゴリは「**ライフスタイル**」「**ユーティリティ**」にして、**子ども専用ではなく「家族向け」**として申請 → 制約が緩和される

### i-mobile 広告
- **Apple**: SKAdNetwork 対応推奨。i-mobile が対応してれば問題なし(要確認)
- **Google**: Families ポリシー対象なら**非パーソナライズ広告のみ**等の制限。i-mobile 管理画面でカテゴリ除外を必ず設定
- 両ストアでサードパーティ広告 SDK は申告必須

### Firebase
- **データセーフティ / App Privacy** で以下を申告:
  - 認証情報(メール、Google ID)
  - ユーザー作成コンテンツ(おつかいリスト、写真)
  - サーバーリージョン: アジア南東部(`asia-southeast1`)

### 必須ドキュメント
- **プライバシーポリシー**(両ストア必須・自前ホスティング必要)
- **利用規約**(任意だが推奨)
- **サポート連絡先**(メールアドレスでOK)

---

## 無料で揃えられるツール集

| 用途 | 無料ツール |
|------|-----------|
| TWA / Android パッケージ生成 | [PWABuilder](https://www.pwabuilder.com/) / [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap) |
| iOS ラッパー | [Capacitor](https://capacitorjs.com/) / PWABuilder iOS テンプレート |
| Xcode | App Store(無料、要 Mac) |
| Android Studio | 公式サイト(無料) |
| アイコン編集 | [Figma](https://figma.com/)(無料プランで十分) |
| スクリーンショット枠合成 | [App Mockup](https://app-mockup.com/) 無料枠 / [Previewed](https://previewed.app/) / Figma |
| プライバシーポリシー生成 | [Privacy Policy Generator](https://www.privacypolicygenerator.info/) / [App-Privacy-Policy-Generator](https://app-privacy-policy-generator.nisrulz.com/) |
| プライバシーポリシー ホスティング | GitHub Pages の `privacy.html`(無料) |
| 独自ドメイン(任意) | Cloudflare Registrar(原価) / Freenom(無料、ただし `.tk` `.ml` 等で信頼性低) |

---

## コストまとめ表

| シナリオ | 初回 | 年額継続 |
|---------|------|---------|
| **Phase 0(PWA のみ)** | 0円 | 0円 |
| **Phase 1(Android のみ)** | 約 3,800 円 | 0円 |
| **Phase 1 + 独自ドメイン** | 約 7,000 円 | 約 3,000 円 |
| **Phase 1 + Phase 2(Mac あり)** | 約 19,000 円 | 約 15,000 円 |
| **Phase 1 + Phase 2(MacInCloud で年1回ビルド)** | 約 8,000 円 | 約 19,500 円 |
| **Phase 1 + Phase 2(Mac 購入)** | 約 70,000 円 | 約 15,000 円 |

---

## 推奨タイムライン

| 時期 | 状態 | アクション |
|------|------|-----------|
| 今 | Phase 0 | 知人に配って反応を見る |
| ユーザー 10 家庭 | 引き続き Phase 0 | プライバシーポリシー準備、独自ドメイン検討 |
| ユーザー 30 家庭 | **Phase 1 開始** | $25 払って Play 申請 |
| Play で MAU 100+ / 広告収益 月数千円 | Phase 1 安定 | iOS の必要性を判断 |
| 上記+「iPhone ユーザーから要望多数」 | **Phase 2 開始** | $99 払って App Store 申請 |

---

## 最小コストで始めるなら

1. **Cloudflare で独自ドメイン取得**(年 1,500 円程度、任意)
2. **`docs/banner-prompt.md` の素材で ChatGPT Image でバナー/スクリーンショット作成**(無料)
3. **PWABuilder で Android パッケージ生成**(無料)
4. **GitHub Pages に `privacy.html` を追加**(無料)
5. **Google Play Console $25 で申請**(初回のみ)

→ **総費用 約 5,300 円で Android リリース可能**。iOS は反応見てから。
