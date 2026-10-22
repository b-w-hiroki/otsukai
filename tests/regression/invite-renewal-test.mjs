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
  window.__renewalCalls = 0;
  firebase.app = () => ({ functions: region => ({ httpsCallable: name => async payload => {
    if (region !== "asia-southeast1" || name !== "createFamilyInvite" || payload.familyId !== state.familyId) throw new Error("unexpected callable");
    window.__renewalCalls++;
    state.family.meta.inviteCode = "NEWCODE23456";
    state.family.meta.inviteExpiresAt = Date.now() + 7 * 86400000;
    renderSettings();
    return { data: { code: "NEWCODE23456" } };
  } }) });
});
await button.click();
await page.waitForFunction(() => window.__renewalCalls === 1 && !document.getElementById("btn-renew-invite").disabled);
check("成功後に新コードが表示される", await page.locator("#set-invite-code").inputValue() === "NEWCODE23456");
check("成功後に期限が表示される", (await page.locator("#set-invite-status").textContent()).includes("有効期限"));
await page.evaluate(() => {
  state.myRole = "child";
  renderSettings();
});
check("子どもには再発行ボタンを表示しない", !(await button.isVisible()));
await page.evaluate(() => renewFamilyInvite());
check("子どもの直接呼び出しも操作しない", !(await button.isVisible()) &&
  await page.evaluate(() => window.__renewalCalls === 1));
await t.finish();
