// Firebase SDK（gstatic.com）が読み込めなかったとき（広告ブロッカー等）、
// 「読み込み中…」のまま無限に固まらず、案内画面（#screen-load-error）に切り替わることを検証。
// 過去に踏んだ「真っ白のまま固まる」系統の不具合クラスの再発防止（docs/rules/deploy.md §4）。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

// firebase-app-compat.js を空スクリプトに差し替え、firebase 未定義（SDK読み込み失敗）を再現
await page.route("**/__fb/firebase-app-compat.js", (route) =>
  route.fulfill({ status: 200, contentType: "text/javascript", body: "// blocked" }));

await page.goto(t.url, { waitUntil: "domcontentloaded" });
await sleep(1500);

check("読み込み失敗の案内画面に切り替わる",
  await page.locator("#screen-load-error").evaluate((el) => el.classList.contains("active")));
check("読み込み中スクリーンでは止まらない",
  !(await page.locator("#screen-loading").evaluate((el) => el.classList.contains("active"))));
check("再読み込みボタンがある", (await page.locator("#btn-load-error-reload").count()) === 1);

// firebase 未定義による想定内のエラーがログに乗るため、page error は無視して判定
await t.finish({ failOnPageError: false });
