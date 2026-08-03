// 設定タブの各カードをアコーディオンにしたことの検証。
// 縦に長くなりすぎるのを防ぐため、既定で閉じておき、端末ごとに開閉状態を覚える。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

await t.ready();
await page.click('[data-tab="settings"]');
await sleep(500);

// --- 既定ではすべて閉じている ---
const accCount = await page.locator("#tab-settings .settings-acc").count();
check("設定タブにアコーディオンカードがある", accCount >= 6, `${accCount}枚`);
const closedCount = await page.locator("#tab-settings .settings-acc.closed").count();
check("既定ではすべて閉じている", closedCount === accCount, `closed=${closedCount}/${accCount}`);
check("閉じているときは本文が非表示", !(await page.locator("#set-name").isVisible()));

// --- タップ領域が44px以上 ---
const hdrBox = await page.locator('.settings-acc[data-acc="profile"] [data-acc-toggle]').boundingBox();
check("見出しのタップ領域が44px以上", hdrBox.height >= 44, `高さ=${Math.round(hdrBox.height)}`);

// --- クリックで開く・シェブロンが回転する ---
const profileToggle = page.locator('.settings-acc[data-acc="profile"] [data-acc-toggle]');
await profileToggle.click();
await sleep(400);
check("クリックで開く", !(await page.locator('.settings-acc[data-acc="profile"]').evaluate(el => el.classList.contains("closed"))));
check("本文が見える", await page.locator("#set-name").isVisible());
check("aria-expandedがtrueになる", (await profileToggle.getAttribute("aria-expanded")) === "true");
const chevronOpen = await page.locator('.settings-acc[data-acc="profile"] .settings-acc-chevron')
  .evaluate((el) => getComputedStyle(el).transform);
check("開いているときシェブロンは無回転", chevronOpen === "none", chevronOpen);

// --- もう一度クリックで閉じる ---
await profileToggle.click();
await sleep(400);
check("再クリックで閉じる", await page.locator('.settings-acc[data-acc="profile"]').evaluate(el => el.classList.contains("closed")));
check("aria-expandedがfalseに戻る", (await profileToggle.getAttribute("aria-expanded")) === "false");
const chevronClosed = await page.locator('.settings-acc[data-acc="profile"] .settings-acc-chevron')
  .evaluate((el) => getComputedStyle(el).transform);
check("閉じているときシェブロンが回転する", chevronClosed !== "none", chevronClosed);

// --- 開閉状態は端末ごとに記憶され、リロードしても復元される ---
await profileToggle.click(); // 開く
await sleep(400);
await page.click('.settings-acc[data-acc="family"] [data-acc-toggle]'); // こちらも開く
await sleep(400);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("#screen-main", { state: "visible", timeout: 20000 });
await sleep(1200);
await page.click('[data-tab="settings"]');
await sleep(500);
check("リロード後もプロフィールは開いたまま", !(await page.locator('.settings-acc[data-acc="profile"]').evaluate(el => el.classList.contains("closed"))));
check("リロード後も家族は開いたまま", !(await page.locator('.settings-acc[data-acc="family"]').evaluate(el => el.classList.contains("closed"))));
check("開かなかった通知カードは閉じたまま", await page.locator('.settings-acc[data-acc="notify"]').evaluate(el => el.classList.contains("closed")));

// --- 保護者のメンバー管理カード: 外側のアコーディオンと内側の安全ゲートが両方効く ---
await page.click('.settings-acc[data-acc="member-admin"] [data-acc-toggle]');
await sleep(400);
check("メンバー管理を開いても内側の危険操作はまだ隠れている", !(await page.locator("#member-admin-body").isVisible()));
await page.click("#btn-member-admin-toggle");
await sleep(400);
check("内側のボタンでさらに開くと管理メニューが見える", await page.locator("#member-admin-body").isVisible());

await t.finish();
