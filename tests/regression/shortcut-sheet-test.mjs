// よく買うものの表示をポップオーバーからボトムシートに変更したことの検証。
// 元の吹き出し（position:absolute）は品数が多いと画面からはみ出し、
// 下の方の項目をタップできなくなることがあった。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

await t.ready();
await page.click('[data-tab="requests"]');
await sleep(400);

// --- 開くとボトムシート（下からスライドイン）になっている ---
await page.click("#btn-shortcut-toggle");
await sleep(500);
check("シートが開く", await page.locator("#shortcut-sheet.open").isVisible());
check("バックドロップも出る（他のシートと同じ挙動）", await page.locator("#sheet-backdrop.open").count() === 1);
const box = await page.locator("#shortcut-sheet").boundingBox();
check("画面下部から出ている（吹き出しの浮遊配置ではない）", box.y + box.height >= 800, `bottom=${Math.round(box.y + box.height)}`);

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

// --- ✕ボタンで閉じられる ---
await page.click("#btn-shortcut-sheet-close");
await sleep(500);
check("✕で閉じる", !(await page.locator("#shortcut-sheet.open").count()));
check("バックドロップも消える", !(await page.locator("#sheet-backdrop.open").count()));

// --- バックドロップタップでも閉じられる ---
await page.click("#btn-shortcut-toggle");
await sleep(500);
await page.click("#sheet-backdrop", { position: { x: 10, y: 10 } });
await sleep(500);
check("バックドロップタップでも閉じる", !(await page.locator("#shortcut-sheet.open").count()));

// --- 品数が多いときにスクロールでき、末尾の項目まで実際に操作できる ---
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
await page.click("#btn-shortcut-toggle");
await sleep(700);
const sheetBox = await page.locator("#shortcut-sheet").boundingBox();
check("画面をはみ出さない（88dvh制約が効いている）", sheetBox.height <= 844 * 0.9, `高さ=${Math.round(sheetBox.height)}`);
const lastRow = page.locator(".shortcut-row").filter({ hasText: "大量テスト品24" }).first();
await lastRow.scrollIntoViewIfNeeded();
await sleep(400);
check("一番下の項目までスクロールして表示できる", await lastRow.isVisible());
const beforeCount = await page.locator(".check-row").count();
await lastRow.click();
await sleep(800);
check("末尾の項目も実際にタップして追加できる（吹き出しの範囲外問題が解消）",
  (await page.locator(".check-row").filter({ hasText: "大量テスト品24" }).count()) === 1, `直前リスト件数=${beforeCount}`);

// --- ✏️編集ボタン・登録ボタンは引き続き動く ---
await page.click("#btn-shortcut-toggle");
await sleep(600);
await page.click("#btn-shortcut-edit");
await sleep(400);
check("編集モードで削除×が出る", (await page.locator(".shortcut-row-del").count()) > 0);
await page.click("#btn-shortcut-edit");
await sleep(300);
await page.click("#btn-shortcut-register");
await sleep(700);
check("登録シートが開く", await page.locator("#sheet-add.open").isVisible());
check("よく買うものシートは自動で閉じている", !(await page.locator("#shortcut-sheet.open").count()));

await t.finish();
