// 「買うよ」→「買ったよ」の操作を検証
import { startHarness } from "../harness.mjs";
const t = await startHarness();
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(900);

// --- 他の人（たろう）が宣言済みの「食パン」 ---
const bread = page.locator(".check-row", { hasText: "食パン" }).first();
check("他人の宣言済み行に「買ったよ」ボタン", await bread.locator(".check-done-btn").count()===1);
await page.screenshot({path:`${OUT}/b1-claimed-rows.png`});

// --- 自分で「買うよ」→「買ったよ」 ---
const milk = page.locator(".check-row", { hasText: "牛乳" }).first();
await milk.locator(".check-circle").click();
await sleep(700);
const milk2 = page.locator(".check-row", { hasText: "牛乳" }).first();
check("買うよ後に「買ったよ」ボタンが出る", await milk2.locator(".check-done-btn").count()===1);
await page.screenshot({path:`${OUT}/b2-after-claim.png`});
await milk2.locator(".check-done-btn").click();
await sleep(800);
check("「買ったよ」で一覧から消える", await page.locator("#list-open .check-row",{hasText:"牛乳"}).count()===0);

// --- 他人の宣言を「買ったよ」（確認ダイアログ経由） ---
t.clearDialogs();
await page.locator(".check-row",{hasText:"食パン"}).first().locator(".check-done-btn").click();
await sleep(800);
check("他人の宣言では確認が出る", t.lastDialog().includes("たろう") && t.lastDialog().includes("買ったこと"), t.lastDialog().replace(/\n/g," ").slice(0,50));
check("承認すると完了になる", await page.locator("#list-open .check-row",{hasText:"食パン"}).count()===0);

// --- 詳細内にも「買ったよ」があるか（新たに宣言して確認） ---
const egg = page.locator(".check-row",{hasText:"卵"}).first();
await egg.locator(".check-circle").click();
await sleep(700);
await page.locator(".check-row",{hasText:"卵"}).first().locator(".check-main").click();
await sleep(500);
check("詳細内にも「買ったよ」", await page.locator(".check-detail [data-complete]").count()>=1);
await page.screenshot({path:`${OUT}/b3-detail-done.png`});

if(errs.length)fail++;

await t.finish();
