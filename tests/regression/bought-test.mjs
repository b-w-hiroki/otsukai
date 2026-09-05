// 「買うよ」→「買ったよ」の操作を検証
import { startHarness } from "../harness.mjs";
const t = await startHarness();
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(900);

// --- 「牛乳」と同名のストックを🔴切れた状態で用意しておく（後段の完了で自動補充されるか検証） ---
await page.click('[data-tab="stock"]'); await sleep(500);
await page.click("#btn-stock-register"); await sleep(400);
await page.fill("#stock-name", "牛乳");
await page.click('.slp-btn[data-lvl="out"]');
await page.click("#btn-add-stock"); await sleep(600);
check("ストック「牛乳」が🔴切れてるに入る", (await page.locator("#stock-out-section").innerText()).includes("牛乳"));
await page.click('[data-tab="requests"]'); await sleep(500);

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

// --- 「買ったよ」で同名ストックが自動的に🟢たっぷりへ戻る（そろそろ切れるかもに出続ける不具合の修正） ---
await page.click('[data-tab="stock"]'); await sleep(600);
check("同名ストック「牛乳」が🟢たっぷりに自動で戻る", (await page.locator("#stock-ok-section").innerText()).includes("牛乳"));
check("🔴切れてるセクションには残らない", !(await page.locator("#stock-out-section").innerText()).includes("牛乳"));
await page.click('[data-tab="requests"]'); await sleep(500);

// --- 他人の宣言を「買ったよ」（確認ダイアログ経由） ---
t.clearDialogs();
await page.locator(".check-row",{hasText:"食パン"}).first().locator(".check-done-btn").click();
await sleep(800);
check("他人の宣言では確認が出る", t.lastDialog().includes("たろう") && t.lastDialog().includes("買ったこと"), t.lastDialog().replace(/\n/g," ").slice(0,50));
check("承認すると完了になる", await page.locator("#list-open .check-row",{hasText:"食パン"}).count()===0);

// --- 詳細を開いても「買ったよ」は行のボタンだけ（詳細内に重複させない） ---
const egg = page.locator(".check-row",{hasText:"卵"}).first();
await egg.locator(".check-circle").click();
await sleep(700);
const eggRow = page.locator(".check-row",{hasText:"卵"}).first();
await eggRow.locator(".check-main").click();
await sleep(500);
check("詳細を開いても行の「買ったよ」はそのまま押せる", await eggRow.locator(".check-done-btn").count()===1);
check("詳細内には「買ったよ」を重複させない", await page.locator(".check-detail [data-complete]").count()===0);
check("詳細には💬とよく買うもの登録は出る", await page.locator(".check-detail-actions .rc-comment-btn").count()===2);
await eggRow.locator(".check-done-btn").click();
await sleep(800);
check("行から「買ったよ」を押すと完了になる", await page.locator("#list-open .check-row",{hasText:"卵"}).count()===0);
await page.screenshot({path:`${OUT}/b3-detail-done.png`});

if(errs.length)fail++;

await t.finish();
