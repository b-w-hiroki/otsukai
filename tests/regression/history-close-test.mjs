// 履歴シートが「開いた後に閉じられる」ことの回帰テスト
import { startHarness } from "../harness.mjs";
const t = await startHarness();
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#screen-main", { state: "visible", timeout: 20000 });
await sleep(800);

// 履歴を開く（完了28件＝かなり長い）
await page.click("#btn-history-float");
await sleep(800);
check("履歴シートが開く", await page.locator("#history-sheet.open").count() === 1);
const rows = await page.locator("#history-list .req-row").count();
check("履歴に多数のアイテム", rows >= 20, rows + "件");

// シートが画面内に収まっているか
const sheetBox = await page.locator("#history-sheet").boundingBox();
check("シート上端が画面内 (y>=0)", sheetBox.y >= 0, "y=" + Math.round(sheetBox.y));
check("シート高さが画面以下", sheetBox.height <= 844, Math.round(sheetBox.height) + "px");

// ✕ボタンが画面内でクリック可能か
const closeBtn = page.locator("#btn-history-close");
const cb = await closeBtn.boundingBox();
check("✕ボタンが画面内", cb && cb.y >= 0 && cb.y + cb.height <= 844, cb ? "y=" + Math.round(cb.y) : "not found");
check("✕ボタンが可視", await closeBtn.isVisible());

// 実際に閉じる
await closeBtn.click();
await sleep(600);
check("✕タップで閉じる", await page.locator("#history-sheet.open").count() === 0);
check("背景も消える", await page.locator("#sheet-backdrop.open").count() === 0);

// 背景タップでも閉じられるか
await page.click("#btn-history-float");
await sleep(700);
await page.locator("#sheet-backdrop").click({ position: { x: 195, y: 40 } });
await sleep(600);
check("背景タップで閉じる", await page.locator("#history-sheet.open").count() === 0);

// 履歴内スクロール後もヘッダーが残るか（sticky）
await page.click("#btn-history-float");
await sleep(700);
await page.locator("#history-sheet .sheet-content").evaluate(el => el.scrollTop = 600);
await sleep(400);
const cb2 = await page.locator("#btn-history-close").boundingBox();
check("スクロール後も✕が画面内(sticky)", cb2 && cb2.y >= 0 && cb2.y + cb2.height <= 844, cb2 ? "y=" + Math.round(cb2.y) : "not found");
await page.screenshot({ path: `${OUT}/hist-scrolled.png` });
await page.click("#btn-history-close");
await sleep(500);
check("スクロール後も閉じられる", await page.locator("#history-sheet.open").count() === 0);

await t.finish();
