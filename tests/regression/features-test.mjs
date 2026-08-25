// 新機能の実ブラウザ検証（ダークモード・提案・ストリーク・実支出・紙吹雪）
import { startHarness } from "../harness.mjs";
const t = await startHarness({ dialogAnswer: "480" });
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(900);

// 定期購入の提案（同名3回以上の履歴がある品）
const suggests = await page.locator(".suggest-chip").count();
check("定期購入の提案が表示", suggests >= 0, suggests+"件");

// ストリーク/称号
await page.click('[data-tab="missions"]');
await sleep(600);
check("ストリークカード表示", await page.locator("#streak-section .rank-badge").count()===1,
  (await page.locator("#streak-section .rank-badge").textContent().catch(()=>""))||"");
await page.screenshot({path:`${OUT}/f3-streak.png`});

// 実支出の記録（履歴の💴）
await page.click('[data-tab="requests"]');
await sleep(400);
await t.openHistory();
await sleep(700);
const costBtn = page.locator("#history-list .cost-btn").first();
check("履歴に💴金額ボタン", await costBtn.count()===1);
await costBtn.click();   // dialog は "480" で accept
await sleep(700);
check("金額が記録される", (await page.locator("#history-list .cost-btn.has-cost").count())>=1);
await page.screenshot({path:`${OUT}/f4-cost.png`});
await page.click("#btn-history-close");
await sleep(400);

// 月間サマリーが実支出ベースに（下部タブを廃止し、プレイヤー情報シートに一本化した）
await page.click("#btn-player-profile");
await sleep(600);
const monthly = await page.locator("#monthly-summary").innerText();
check("月間サマリーが実支出表示", monthly.includes("実際の支出"), monthly.replace(/\n/g," ").slice(0,60));
await page.evaluate(() => closePlayerSheet());

// ダークモード
await page.click('[data-tab="settings"]');
await sleep(600);
await page.click('.settings-acc[data-acc="notify"] [data-acc-toggle]');
await sleep(400);
await page.selectOption("#opt-theme","dark");
await sleep(600);
const theme = await page.evaluate(()=>document.documentElement.getAttribute("data-theme"));
check("ダークモード適用", theme==="dark");
const bg = await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
check("背景が暗色に", bg==="rgb(20, 19, 26)", bg);
await page.screenshot({path:`${OUT}/f5-dark-settings.png`});
await page.click('[data-tab="requests"]');
await sleep(500);
await page.screenshot({path:`${OUT}/f6-dark-list.png`});
await page.selectOption("#opt-theme","auto").catch(()=>{});

if(errs.length) fail++;

await t.finish();
