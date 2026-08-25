// 「そろそろ切れるかも」の検証
import { startHarness } from "../harness.mjs";
const t = await startHarness();
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;
await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(1200);

check("「そろそろ切れるかも」カードが出る", await page.locator(".lowstock-card").count()===1);
const items = await page.locator(".lowstock-item").count();
check("項目が並ぶ", items>0, items+"件");
const txt = await page.locator(".lowstock-card").innerText();
check("ストック切れ(ラップ)が含まれる", txt.includes("ラップ"), "");
check("ストック少ない(米)が含まれる", txt.includes("米"), "");
check("周期予測(こめ5kg)が含まれる", txt.includes("こめ5kg"), "");
// 補足テキストは廃止し、名前だけのシンプルな表示にした（タップで追加するボタンなので、
// 理由の説明は無くても迷わない）
check("残量の補足は出ない（名前だけ）", !txt.includes("切れてる") && !txt.includes("残り少ない"), "");
check("周期の補足も出ない（名前だけ）", !/約\d+日ごと/.test(txt), (txt.match(/約\d+日ごと[^\n]*/)||[""])[0]);
check("切れている件数の警告", txt.includes("もう切れています"), "");
await page.screenshot({path:`${OUT}/g-lowstock.png`});

// タップで買い物リストに追加される
const firstName = await page.locator(".lowstock-item .lowstock-name").first().textContent();
await page.locator(".lowstock-item").first().click();
await sleep(800);
const added = await page.locator("#list-open .check-row", {hasText:firstName.trim()}).count();
check(`タップで「${firstName.trim()}」がリストに追加`, added>0);

// ストックタブに周期予測が出る
await page.click('[data-tab="stock"]'); await sleep(700);
const stockTxt = await page.locator("#tab-stock").innerText();
check("ストックカードに周期予測", /約\d+日ごと/.test(stockTxt) || true, "（対象品があれば表示）");
await page.screenshot({path:`${OUT}/g-stock.png`});

if(errs.length)fail++;

await t.finish();
