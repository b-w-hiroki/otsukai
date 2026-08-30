// 初回オンボーディング（使い方＋ホーム画面追加の案内、app-init.js）を検証。
// harness.mjs は他の回帰テストが毎回このモーダルにブロックされないよう、既定で
// localStorage.onboardingSeen = "1"（初期化スクリプトで毎回上書き）にしている。
// そのため「初回」の再現は、ページ内で直接 localStorage を消して maybeShowOnboarding()
// を呼ぶ形で行う（reload だと harness の初期化スクリプトが毎回 "1" に戻してしまうため）。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

await t.ready();
check("通常時（見た事にされた状態）ではオンボーディングは出ない",
  !(await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open"))));

// --- 初回を再現 ---
await page.evaluate(() => { localStorage.removeItem("onboardingSeen"); maybeShowOnboarding(); });
await sleep(200);
check("初回はオンボーディングが自動で開く",
  await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open")));
check("1ページ目（ようこそ）が表示されている",
  await page.locator('.onboarding-page[data-step="0"]').evaluate((el) => el.classList.contains("active")));

for (let i = 0; i < 3; i++) {
  await page.click("#btn-onboarding-next");
  await sleep(150);
}
check("「次へ」を3回押すと最後（ホーム画面に追加）のステップになる",
  await page.locator('.onboarding-page[data-step="3"]').evaluate((el) => el.classList.contains("active")));
check("最後のステップに案内文が入っている",
  (await page.locator("#onboarding-install-body").innerText()).length > 0);
check("最後のボタンは「はじめる」になる",
  (await page.locator("#btn-onboarding-next").innerText()) === "はじめる");

await page.click("#btn-onboarding-next");
await sleep(200);
check("「はじめる」を押すと閉じる",
  !(await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open"))));
check("見た記録が端末（localStorage）に残る",
  (await page.evaluate(() => localStorage.getItem("onboardingSeen"))) === "1");

// もう一度 attachFamilyListeners() 相当が走っても（再ログイン・再接続等）、
// 見た後なら再表示されないことを確認
await page.evaluate(() => maybeShowOnboarding());
await sleep(200);
check("見た後は同じセッション内で再度呼んでも開かない",
  !(await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open"))));

// --- スキップでも同様に閉じて記録されることを確認 ---
await page.evaluate(() => { localStorage.removeItem("onboardingSeen"); maybeShowOnboarding(); });
await sleep(200);
check("フラグを消して呼び直すと再表示される",
  await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open")));
await page.click("#btn-onboarding-skip");
await sleep(200);
check("スキップでも閉じる",
  !(await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open"))));
check("スキップでも記録される",
  (await page.evaluate(() => localStorage.getItem("onboardingSeen"))) === "1");

await t.finish();
