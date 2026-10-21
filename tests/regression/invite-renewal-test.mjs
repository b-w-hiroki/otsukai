import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page } = t;
const check = t.check;

await t.ready();
await page.click('[data-tab="settings"]');
await page.locator('[data-acc="family"] [data-acc-toggle]').click();
const button = page.locator("#btn-renew-invite");
check("保護者は招待コードを再発行できる", await button.isVisible());
check("旧コードの移行案内が表示される", (await page.locator("#set-invite-status").textContent()).includes("旧形式"));
await page.evaluate(() => {
  state.family.meta.inviteExpiresAt = Date.now() - 1000;
  renderSettings();
});
check("期限切れを表示する", (await page.locator("#set-invite-status").textContent()).includes("期限"));
await button.click();
await page.waitForFunction(() => !document.getElementById("btn-renew-invite").disabled);
check("発行失敗後に再試行できる", !(await button.isDisabled()));
await button.click();
await page.waitForFunction(() => !document.getElementById("btn-renew-invite").disabled);
check("再試行後もボタンが戻る", !(await button.isDisabled()));
await page.evaluate(() => {
  state.myRole = "child";
  renderSettings();
});
check("子どもには再発行ボタンを表示しない", !(await button.isVisible()));
await page.evaluate(() => renewFamilyInvite());
check("子どもの直接呼び出しも操作しない", !(await button.isVisible()));
await t.finish();
