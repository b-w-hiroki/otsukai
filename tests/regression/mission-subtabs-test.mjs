// ミッションタブ内のサブタブ切り替え（⚡ウィークリー/🎁ごほうび/🎯ミッション）の検証。
// 縦積みで長くなっていたのをタブ分けした。🔥ストリークだけは常に見える。
import { startHarness } from "../harness.mjs";
const t = await startHarness();
const { page, sleep } = t;
const check = t.check;

await t.ready();
await page.click('[data-tab="missions"]');
await sleep(700);

// --- 初期状態: ウィークリーが選ばれていて、ごほうび/ミッションは隠れている ---
check("初期表示はウィークリーが選択されている",
  await page.locator('.seg-btn[data-msub="weekly"]').evaluate((el) => el.classList.contains("active")));
check("ウィークリーの中身が見えている", await page.locator("#weekly-missions-section").isVisible());
check("ごほうびは隠れている", !(await page.locator("#rewards-section").isVisible()));
check("ミッションは隠れている", !(await page.locator("#missions-content").isVisible()));
check("🔥ストリークは常に見えている（サブタブの外）", await page.locator("#streak-section .rank-badge").isVisible());

// タップ領域（rules/ui.md: 44px以上）
const box = await page.locator('.seg-btn[data-msub="rewards"]').boundingBox();
check("サブタブのタップ領域が44px以上", box.height >= 44, `高さ${Math.round(box.height)}px`);

// --- 🎁ごほうびに切り替え ---
await page.click('.seg-btn[data-msub="rewards"]');
await sleep(400);
check("ごほうびが見える", await page.locator("#rewards-section").isVisible());
check("ウィークリーは隠れる", !(await page.locator("#weekly-missions-section").isVisible()));
check("ミッションは隠れたまま", !(await page.locator("#missions-content").isVisible()));
check("ストリークは引き続き見えている", await page.locator("#streak-section .rank-badge").isVisible());
check("ボタンの選択状態も切り替わる",
  await page.locator('.seg-btn[data-msub="rewards"]').evaluate((el) => el.classList.contains("active")));
check("ウィークリーのボタンは非選択になる",
  !(await page.locator('.seg-btn[data-msub="weekly"]').evaluate((el) => el.classList.contains("active"))));

// ごほうび交換が実際に操作できる（隠れていた要素が操作可能になっているか）
const rewardRow = page.locator(".reward-row").filter({ hasText: "アイス" }).first();
check("ごほうび一覧が操作できる状態", (await rewardRow.count()) === 1);
await t.shot("mission-rewards");

// --- 🎯ミッションに切り替え ---
await page.click('.seg-btn[data-msub="admin"]');
await sleep(400);
check("ミッションが見える", await page.locator("#missions-content").isVisible());
check("ごほうびは隠れる", !(await page.locator("#rewards-section").isVisible()));
await t.shot("mission-admin");

// --- 他のタブへ行って戻っても、選択していたサブタブが保持される ---
await page.click('[data-tab="requests"]');
await sleep(500);
await page.click('[data-tab="missions"]');
await sleep(500);
check("タブを行き来しても選択中のサブタブが保持される",
  await page.locator("#missions-content").isVisible());

await t.finish();
