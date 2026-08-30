// アカウント削除の最終確認（"delete" と入力させる誤操作防止）を検証。
// perf-test.mjs は「正しく入力した場合に実際の呼び出しまで届く」ことを検証しているので、
// ここでは「間違えて入力した場合に中止されること」を確認する。
import { startHarness } from "../harness.mjs";

const t = await startHarness({ noAnimation: true, dialogAnswer: "yes delete please" });
const { page, sleep } = t;
const check = t.check;

await t.ready();
await page.click('[data-tab="settings"]');
await sleep(500);
await page.click('.settings-acc[data-acc="profile"] [data-acc-toggle]');
await sleep(400);
await page.click("#btn-self-delete-toggle");
await sleep(400);
await page.click("#btn-self-delete");
await sleep(600);

const functionsScriptLoaded = await page.evaluate(() =>
  Array.from(document.scripts).some((s) => s.src.includes("firebase-functions-compat")));
check("「delete」以外を入力すると functions-compat.js すら読み込まれず、呼び出しまで届かない",
  !functionsScriptLoaded);
const toast = await page.locator("#toasts").innerText().catch(() => "");
check("入力不一致のトーストが出る", toast.includes("入力が一致しなかった"), toast.replace(/\n/g, " ").slice(0, 60));
check("まだログイン画面には遷移していない（削除されていない）",
  await page.locator("#screen-main").evaluate((el) => el.classList.contains("active")));

await t.finish();
