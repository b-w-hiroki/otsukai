// docs/screenshots/news/2026-09/ を撮り直す。news.js の shots が参照する画像はここに置く。
//   node tests/capture-news.mjs
// テスト用のサンプルデータ（tests/fb-stub.js）で撮る。実データは混ぜない。
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startHarness } from "./harness.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "screenshots", "news", "2026-09");
const t = await startHarness({ shots: OUT, noAnimation: true, newsModal: true, dialogAnswer: "宅配BOXへ" });
const { page, sleep } = t;
const url = t.url;
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log("  ✓", n); };
// トースト（2.8秒で消える）が写り込まないよう、消えるまで待ってから撮る
const clearToasts = async () => {
  try { await page.waitForSelector("#toasts:empty", { timeout: 3200 }); } catch (e) {}
};

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#screen-main", { state: "visible", timeout: 20000 });
await sleep(700);

// --- 新着お知らせモーダル（最初の1回だけ出るので、他の操作より前に撮る） ---
await shot("news-modal");
await page.click("#btn-news-modal-later"); await sleep(300);

// --- おつかい追加シート: 続けて追加する・コンパクト表示 ---
await page.click("#btn-add-float"); await sleep(500);
await shot("continue-add");
await shot("add-sheet-compact");

// --- 「＋くわしく設定」を開いて入力→閉じると「設定あり」の要約 ---
await page.click("#btn-more-fields"); await sleep(300);
await page.fill("#new-budget", "300");
await page.fill("#new-memo", "小さいサイズで");
await page.click("#btn-more-fields"); await sleep(300);
await shot("add-sheet-summary");

// --- 🎨イラストから選ぶピッカー: 通常表示・タブ切り替え・検索 ---
await page.click("#btn-req-photo-icon"); await sleep(500);
await shot("icons");
await page.click('#icon-picker-tabs .icon-picker-tab:has-text("日用品")'); await sleep(300);
await shot("icon-tabs");
await page.fill("#icon-picker-search", "醤油"); await sleep(300);
await shot("icons-search");
await page.click("#btn-icon-picker-close"); await sleep(300);
await page.click("#btn-sheet-close"); await sleep(400); // 提出せずに閉じる（サンプル依頼を汚さない）

// --- 手間マーク（💪💪 めちゃ大変） ---
await page.click("#btn-add-float"); await sleep(500);
await page.fill("#new-name", "特大米袋30kg");
await page.click('#new-category .cat-chip[data-cat="food"]');
await page.selectOption("#new-diff", "extreme");
await page.click("#btn-add-request"); await sleep(700);
{
  const row = page.locator(".check-row", { hasText: "特大米袋30kg" }).first();
  await row.scrollIntoViewIfNeeded(); await sleep(200);
  await row.screenshot({ path: `${OUT}/diff.png` }); console.log("  ✓ diff");
}

// --- プロフィールの絵文字ピッカー（4分類タブ） ---
await page.click('[data-tab="settings"]'); await sleep(400);
await page.click('.settings-acc[data-acc="profile"] [data-acc-toggle]'); await sleep(400);
await page.locator('.settings-acc[data-acc="profile"]').scrollIntoViewIfNeeded(); await sleep(200);
await clearToasts();
await shot("emoji-groups");

// --- 行き先を登録（先に登録してから、行き先ピッカーを持つシートを開く） ---
await page.click('.settings-acc[data-acc="destinations"] [data-acc-toggle]'); await sleep(300);
await page.fill("#new-destination-name", "スーパー");
await page.click("#btn-add-destination"); await sleep(400);
await page.fill("#new-destination-name", "薬局");
await page.click("#btn-add-destination"); await sleep(400);
await page.locator('.settings-acc[data-acc="destinations"]').scrollIntoViewIfNeeded(); await sleep(200);
await clearToasts();
await shot("dest-settings");

// --- 行き先ごとにまとまる買い物リスト ---
await page.click('[data-tab="requests"]'); await sleep(400);
await page.click("#btn-add-float"); await sleep(500);
await page.click("#btn-more-fields"); await sleep(300);
await page.fill("#new-name", "洗剤A");
await page.click('#new-category .cat-chip[data-cat="daily"]');
await page.click('#new-destination .cat-chip:has-text("薬局")');
await page.click("#btn-add-request"); await sleep(700);

await page.click("#btn-add-float"); await sleep(500);
await page.click("#btn-more-fields"); await sleep(300);
await page.fill("#new-name", "洗剤B");
await page.click('#new-category .cat-chip[data-cat="daily"]');
await page.click('#new-destination .cat-chip:has-text("スーパー")');
await page.click("#btn-add-request"); await sleep(700);
await page.locator(".check-row", { hasText: "洗剤A" }).first().scrollIntoViewIfNeeded(); await sleep(200);
await clearToasts();
await shot("dest-list");

// --- 自分以外が追加した依頼に📝メモを追記（先に。あとで牛乳を完了させるので別の未完了依頼を使う） ---
{
  const egg = page.locator(".check-row", { hasText: "卵" }).first();
  await egg.locator(".check-main").click(); await sleep(500);
  await egg.locator("+ .check-detail [data-memo-btn]").click(); await sleep(600);
  await clearToasts();
  await shot("memo");
}

// --- ストック登録シート: カテゴリ選択 ---
await page.click('[data-tab="stock"]'); await sleep(500);
await page.click("#btn-stock-register"); await sleep(400);
await clearToasts();
await shot("stock-category");
await page.click("#btn-stock-sheet-close"); await sleep(300);

// --- 写真付きストックを買い物リストに追加すると、写真が引き継がれる ---
await page.click("#btn-stock-register"); await sleep(400);
await page.fill("#stock-name", "国産バナナ");
await page.click('#stock-category .cat-chip[data-cat="food"]');
await page.click("#btn-stock-photo-icon"); await sleep(400);
await page.fill("#icon-picker-search", "バナナ"); await sleep(300);
await page.click('#icon-picker-grid .icon-picker-tile[data-file="banana"]'); await sleep(400);
await page.click("#btn-add-stock"); await sleep(600);

await page.locator(".stock-item", { hasText: "国産バナナ" }).first().click(); await sleep(500);
await page.click("#btn-stock-detail-add"); await sleep(600);

await page.click('[data-tab="requests"]'); await sleep(500);
{
  const row = page.locator(".check-row", { hasText: "国産バナナ" }).first();
  await row.scrollIntoViewIfNeeded(); await sleep(200);
  await row.screenshot({ path: `${OUT}/photo.png` }); console.log("  ✓ photo");
}

// --- ストック詳細（✏️名前・すっきりした画面） ---
await page.click('[data-tab="stock"]'); await sleep(500);
await page.locator(".stock-item", { hasText: "しょうゆ" }).first().click(); await sleep(500);
await shot("stock-detail");
await page.click("#btn-stock-detail-close"); await sleep(400);
await page.locator(".stock-item", { hasText: "米" }).first().click(); await sleep(500);
await shot("stock-more");
await page.click("#btn-stock-detail-close"); await sleep(400);

// --- 「買ったよ」で完了すると、切れていたストックも🟢たっぷりに戻る ---
await page.click('[data-tab="stock"]'); await sleep(500);
await page.click("#btn-stock-register"); await sleep(400);
await page.fill("#stock-name", "牛乳");
await page.click('#stock-category .cat-chip[data-cat="food"]');
await page.click('.slp-btn[data-lvl="out"]');
await page.click("#btn-add-stock"); await sleep(600);

await page.click('[data-tab="requests"]'); await sleep(500);
{
  const milk = page.locator(".check-row", { hasText: "牛乳" }).first();
  await milk.locator(".check-circle").click(); await sleep(700);
  await milk.locator(".check-done-btn").click(); await sleep(800);
}
await page.click('[data-tab="stock"]'); await sleep(600);
await clearToasts();
await shot("restock");

// --- news.html（一覧・未読の印）は最後に撮る。開くと既読になるため、この順にする ---
await page.goto(url + "news.html", { waitUntil: "domcontentloaded" }); await sleep(600);
await page.screenshot({ path: `${OUT}/news-list.png`, fullPage: true }); console.log("  ✓ news-list");
await page.screenshot({ path: `${OUT}/news-unread.png` }); console.log("  ✓ news-unread");

console.log("完了");
await t.finish();
