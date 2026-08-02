// ◯の挙動: open→買うよ / 自分の宣言→取り消し / 他人の宣言→案内のみ。完了はボタンで。
import { startHarness } from "../harness.mjs";
const t = await startHarness();
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;
// DOMから状態を読む（app.js の state は classic script のトップレベル const なので
// window 経由では参照できない）
const statusOf = (name) => page.evaluate((n)=>{
  const row = [...document.querySelectorAll("#list-open .check-row")]
    .find(el => el.querySelector(".check-name")?.textContent.includes(n));
  if (!row) return "done-or-absent";
  const grp = row.closest(".req-group")?.querySelector("h2")?.textContent.trim() || "?";
  const c = row.querySelector(".check-circle");
  return (c.classList.contains("mine") ? "claimed(自分)" : c.classList.contains("other") ? "claimed(他人)" : "open") + " @" + grp;
}, name);

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(900);

const milkRow = () => page.locator(".check-row",{hasText:"牛乳"}).first();
// 1回目: 買うよ
await milkRow().locator(".check-circle").click(); await sleep(700);
check("1タップ目で「買うよ」", (await milkRow().locator(".check-circle.mine").count())===1, await statusOf("牛乳"));
check("「買ったよ」ボタンが出る", (await milkRow().locator(".check-done-btn").count())===1);
await page.screenshot({path:`${OUT}/c1-claimed.png`});

// 2回目: 買うよ解除（完了にはならない）
await milkRow().locator(".check-circle").click(); await sleep(800);
check("2タップ目で「買うよ」取り消し", (await statusOf("牛乳")).startsWith("open"), await statusOf("牛乳"));
check("完了になっていない（履歴に行かない）", (await page.locator("#list-open .check-row",{hasText:"牛乳"}).count())===1);
check("買ったよボタンが消える", (await milkRow().locator(".check-done-btn").count())===0);
await page.screenshot({path:`${OUT}/c2-unclaimed.png`});

// 3回目: もう一度 買うよ → 「買ったよ」ボタンで完了
await milkRow().locator(".check-circle").click(); await sleep(700);
await milkRow().locator(".check-done-btn").click(); await sleep(800);
check("「買ったよ」ボタンで完了", (await page.locator("#list-open .check-row",{hasText:"牛乳"}).count())===0, await statusOf("牛乳"));

// 他人（たろう）の宣言: ◯タップでは変化しない
const breadBefore = await statusOf("食パン");
await page.locator(".check-row",{hasText:"食パン"}).first().locator(".check-circle").click();
await sleep(700);
check("他人の宣言は◯タップで変化しない", (await statusOf("食パン"))===breadBefore && breadBefore.startsWith("claimed(他人)"), breadBefore);
// 他人の宣言でも「買ったよ」は確認付きで可能
t.clearDialogs();
await page.locator(".check-row",{hasText:"食パン"}).first().locator(".check-done-btn").click();
await sleep(800);
check("他人の宣言も確認後に完了できる", (await page.locator("#list-open .check-row",{hasText:"食パン"}).count())===0, t.lastDialog().slice(0,28));

// 店内モードは1タップ完了のまま
await page.click("#btn-store-mode"); await sleep(700);
await page.locator(".store-item").first().click(); await sleep(700);
check("店内モードは1タップで完了のまま", (await page.locator(".store-item.checked").count())>=1);
await page.click("#btn-store-mode-close");

if(errs.length)fail++;

await t.finish();
