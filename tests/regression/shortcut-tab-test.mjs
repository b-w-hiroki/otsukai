// 「よく買うもの」がフッター（下部ナビ）の独立タブになっていることの検証。
// 以前はシート（ボトムシート）だったが、コア機能として下部ナビの空き枠に昇格した。
// 登録は他のタブ（ストック等）と同じくFABから開く。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

await t.ready();

// --- 下部ナビにタブとして存在し、44px以上のタップ領域を確保している ---
const navBtn = page.locator('.bottom-nav button[data-tab="shortcuts"]');
check("下部ナビに「よく買うもの」タブがある", (await navBtn.count()) === 1);
const navBtnBox = await navBtn.boundingBox();
check("タップ領域が44px以上", navBtnBox.height >= 44, `高さ=${Math.round(navBtnBox.height)}`);

// --- タップで開く・下部ナビの選択状態と背景も連動する ---
await navBtn.click();
await sleep(500);
check("タブが開く", await page.locator("#tab-shortcuts.active").isVisible());
check("下部ナビの選択状態が連動する", await navBtn.evaluate((el) => el.classList.contains("active")));

// --- 色がアンバー系統になっている（紫の主操作色とは別系統） ---
const rowColor = await page.locator(".shortcut-row").first().evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, border: s.borderColor };
});
check("項目の背景色が紫(--pri-soft)ではない", rowColor.bg !== "rgb(238, 236, 251)", JSON.stringify(rowColor));

// hover時にグローバルの紫ボタン色に負けないか（過去に実際に踏んだCSS詳細度バグの再発防止）
const hoverColor = await page.locator(".shortcut-row").last().evaluate(async (el) => {
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 150));
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, bgImage: s.backgroundImage };
});
check("hover時も紫グラデに化けない", hoverColor.bgImage === "none", JSON.stringify(hoverColor));

// --- FABから登録できる（他のタブと同じ導線） ---
await page.click("#fab-add");
await sleep(700);
check("FABから登録シートが開く", await page.locator("#sheet-add.open").isVisible());
check("タイトルがよく買うもの登録になっている", (await page.locator("#sheet-add .sheet-title").innerText()).includes("よく買うもの"));
await page.click("#btn-sheet-close");
await sleep(400);

// --- 品数が多いときもページとして普通にスクロールでき、末尾の項目まで操作できる ---
await page.evaluate(async () => {
  const db = firebase.database();
  const writes = [];
  for (let i = 0; i < 25; i++) {
    writes.push(db.ref("families/fam1/shortcuts").push().set({
      name: `大量テスト品${String(i).padStart(2, "0")}`, diff: "normal",
      createdAt: Date.now(), createdBy: "uid-parent",
    }));
  }
  await Promise.all(writes);
});
await sleep(700);
const lastRow = page.locator(".shortcut-row").filter({ hasText: "大量テスト品24" }).first();
await lastRow.scrollIntoViewIfNeeded();
await sleep(400);
check("一番下の項目までスクロールして表示できる", await lastRow.isVisible());
const beforeCount = await page.locator(".check-row").count();
await lastRow.click();
await sleep(800);
await page.click('[data-tab="requests"]');
await sleep(500);
check("末尾の項目も実際にタップして買い物リストに追加できる",
  (await page.locator(".check-row").filter({ hasText: "大量テスト品24" }).count()) === 1, `直前リスト件数=${beforeCount}`);

// --- ✏️編集ボタンで削除×が出る ---
await page.click('[data-tab="shortcuts"]');
await sleep(500);
await page.click("#btn-shortcut-edit");
await sleep(400);
check("編集モードで削除×が出る", (await page.locator(".shortcut-row-del").count()) > 0);
await page.click("#btn-shortcut-edit");
await sleep(300);
check("編集モード解除で削除×が消える", (await page.locator(".shortcut-row-del").count()) === 0);

// --- 登録が無いときの案内文がFABを指している ---
await page.evaluate(async () => {
  const snap = await firebase.database().ref("families/fam1/shortcuts").once("value");
  const all = snap.val() || {};
  await Promise.all(Object.keys(all).map((id) => firebase.database().ref("families/fam1/shortcuts/" + id).remove()));
});
await sleep(700);
const emptyText = await page.locator(".shortcut-chips-empty").innerText();
check("登録が無いときはFABでの登録を案内する", emptyText.includes("＋"), emptyText);

await t.finish();
