// docs/screenshots/ を撮り直す。手順は docs/rules/workflow.md §4 を参照。
//   node tests/capture-docs.mjs
// テスト用のサンプルデータ（tests/fb-stub.js）で撮る。実データは混ぜない。
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startHarness } from "./harness.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "screenshots");
const t = await startHarness({ shots: OUT, noAnimation: false });
const { page, sleep } = t;
const url = t.url;
const shot=async n=>{await page.screenshot({path:`${OUT}/${n}.png`});console.log("  ✓",n);};

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(1200);
await shot("01-home");                                    // ホーム（そろそろ切れるかも＋チェックリスト）

// そろそろ切れるかも（拡大）
await page.locator(".lowstock-card").scrollIntoViewIfNeeded(); await sleep(300);
await page.locator(".lowstock-card").screenshot({path:`${OUT}/02-lowstock.png`}); console.log("  ✓ 02-lowstock");

// 追加シート（お買い物ページでは右下フロートの＋の代わりに、フロート列の「＋ 追加」を使う）
await page.click("#btn-add-float"); await sleep(700);
await page.fill("#new-name","りんご");
await page.click('#new-category .cat-chip[data-cat="food"]'); await sleep(300);
await shot("03-add-sheet");
await page.click("#btn-sheet-close"); await sleep(500);

// 買うよ → 買ったよ
await page.locator(".check-row",{hasText:"牛乳"}).first().locator(".check-circle").click();
await sleep(800); await shot("04-claimed");

// 詳細展開
await page.locator(".check-row",{hasText:"トイレットペーパー"}).first().locator(".check-main").click();
await sleep(600); await shot("05-detail");
await page.locator(".check-row",{hasText:"トイレットペーパー"}).first().locator(".check-main").click(); await sleep(400);

// 店内モード
await page.click("#btn-store-mode"); await sleep(800); await shot("06-store-mode");
await page.locator(".store-item").first().click(); await sleep(700); await shot("07-store-checked");
await page.click("#btn-store-mode-close"); await sleep(500);
// 「✅完了！」トースト（2.4秒で消える）が次のスクショに写り込まないよう待つ
await sleep(1500);

// よく買うもの（下部タブを廃止し、買い物ページのフローティングボタンから開くシートに一本化した。
// 既定はリスト形式だが、写真が見えるカード形式のほうが説明用として分かりやすいので切り替えて撮る）
await page.click("#btn-shortcut-toggle"); await sleep(700);
await page.click('#shortcut-sheet .shortcut-viewmode-btn[data-viewmode="card"]'); await sleep(400);
await shot("08-shortcuts");
await page.click("#btn-shortcut-register"); await sleep(700);
await page.fill("#new-name", "柔軟剤"); await page.fill("#new-cycle-days", "25");
await shot("18-shortcut-cycle"); // 買う間隔（任意）欄
await page.click("#btn-sheet-close"); await sleep(400);

// 支出・家計（下部タブを廃止し、プレイヤー情報シート（アバター）に一本化した）
await page.click("#btn-player-profile"); await sleep(700); await shot("19-expenses");
await page.evaluate(() => closePlayerSheet()); await sleep(400);

// 履歴（プレイヤー情報シート経由。買い物ページのフロート列からは外した）
await t.openHistory(); await sleep(900); await shot("09-history");
await page.click("#btn-history-close"); await sleep(500);

// ミッション（ウィークリー・ストリーク・ごほうび）
await page.click('[data-tab="missions"]'); await sleep(800); await shot("10-missions");

// ストック
await page.click('[data-tab="stock"]'); await sleep(800); await shot("11-stock");
// 品目ごとの「買う間隔」
await page.locator(".stock-item").filter({hasText:"しょうゆ"}).first().click(); await sleep(700);
await shot("16-stock-cycle");
await page.click("#stock-detail-sheet .sheet-close").catch(()=>{});
await page.click("#sheet-backdrop").catch(()=>{}); await sleep(500);

// そろそろ切れるかも（ストックタブ上部のアコーディオン。既定は閉じている。撮る前に開く）
await page.click('.settings-acc[data-acc="lowlead"] [data-acc-toggle]'); await sleep(400);
await page.locator("#opt-low-lead").scrollIntoViewIfNeeded(); await sleep(300);
// 固定のボトムナビ/FAB がカードに重なるので、この1枚だけ隠して撮る
await page.addStyleTag({content:".bottom-nav,#fab-add,.float-btns{visibility:hidden !important;}"});
await sleep(200);
await page.locator("#opt-low-lead").locator("xpath=ancestor::div[contains(@class,'settings-acc')][1]")
  .screenshot({path:`${OUT}/17-lowlead-setting.png`}); console.log("  ✓ 17-lowlead-setting");
await page.reload({waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000}); await sleep(1200);

// 設定（カードはアコーディオンで既定は閉じている。撮る前に開く）
await page.click('[data-tab="settings"]'); await sleep(800); await shot("12-settings");
await page.click('.settings-acc[data-acc="member-admin"] [data-acc-toggle]'); await sleep(400);
await page.click("#btn-member-admin-toggle"); await sleep(400);
await page.locator("#member-admin-card").scrollIntoViewIfNeeded(); await sleep(300);
await shot("13-member-admin");
await page.click('.settings-acc[data-acc="maintenance"] [data-acc-toggle]'); await sleep(400);
await page.locator("#btn-refresh-data").scrollIntoViewIfNeeded(); await sleep(300);
await shot("14-maintenance");

// ダークモード
await page.click('.settings-acc[data-acc="notify"] [data-acc-toggle]'); await sleep(400);
await page.selectOption("#opt-theme","dark"); await sleep(700);
await page.click('[data-tab="requests"]'); await sleep(700);
await shot("15-dark");
await page.selectOption("#opt-theme","auto").catch(()=>{});

console.log("完了");
await t.finish();
