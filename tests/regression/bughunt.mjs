// 「そろそろ切れるかも」まわりのバグ探し
import { startHarness } from "../harness.mjs";
const t = await startHarness({ label: "BUG", noAnimation: true });
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;
const names=async()=>page.locator(".lowstock-name").allInnerTexts();
const card=async()=>page.locator(".lowstock-card").innerText().catch(()=>"");

await page.addInitScript(()=>{const st=document.createElement("style");st.textContent="*{animation:none !important;transition:none !important;}";document.addEventListener("DOMContentLoaded",()=>document.head.appendChild(st));});
await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(1200);

console.log("初期の並び:", (await names()).join(" / "));

// --- ① ストック行の × で消えるか ---
const row = page.locator(".lowstock-item").filter({hasText:"ラップ"}).first();
await row.locator(".lowstock-x").click();
await sleep(600);
check("ストック行の × で消える", !(await names()).includes("ラップ"), (await names()).join(" / "));

// --- ② 周期予測行の × で消えるか ---
const before = await names();
if (before.includes("こめ5kg")) {
  await page.locator(".lowstock-item").filter({hasText:"こめ5kg"}).first().locator(".lowstock-x").click();
  await sleep(600);
  check("周期予測行の × で消える", !(await names()).includes("こめ5kg"), (await names()).join(" / "));
}

// --- ③ × を押しても「＋追加」が誤発火しないか ---
const listBefore = await page.locator(".check-row").count();
if ((await page.locator(".lowstock-item").count())>0) {
  await page.locator(".lowstock-item").first().locator(".lowstock-x").click();
  await sleep(600);
  check("× で買い物リストに追加されない", (await page.locator(".check-row").count())===listBefore,
    `${listBefore} → ${await page.locator(".check-row").count()}`);
}

// --- ④ 件数バッジと実際の行数が一致するか（上限6件の切り捨て時） ---
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(1200);
await page.click('[data-tab="stock"]'); await sleep(500);
await page.click('.settings-acc[data-acc="lowlead"] [data-acc-toggle]'); await sleep(400);
await page.selectOption("#opt-low-lead","30"); await sleep(700);
await page.click('[data-tab="requests"]'); await sleep(800);
const badge = parseInt(await page.locator(".lowstock-count").innerText(),10);
const rows  = await page.locator(".lowstock-item").count();
check("件数バッジと行数が一致", badge===rows, `バッジ${badge} / 行${rows}`);

// --- ⑤ 「もう切れています」の件数が本当に在庫切れの数か ---
const txt = await card();
const m = txt.match(/(\d+)件はもう切れています/);
const redRows = await page.locator(".lowstock-item .lowstock-icon").allInnerTexts();
const actuallyOut = redRows.filter(t=>t.includes("🔴")).length;
if (m) check("「もう切れています」の件数が🔴の数と一致", Number(m[1])===actuallyOut,
  `文言${m[1]}件 / 🔴${actuallyOut}件（アイコン: ${redRows.join("")}）`);

// --- ⑥ ストックを🟢に戻すと周期の起点が更新されるか ---
await page.click('[data-tab="stock"]'); await sleep(700);
const wrapRow = page.locator(".stock-item").filter({hasText:"ラップ"}).first();
await wrapRow.locator(".stock-level-btn").click({force:true}); await sleep(600); // out -> ok
const lvl = await page.evaluate(async ()=>
  (await firebase.database().ref("families/fam1/stocks/st3").once("value")).val());
check("🟢に戻すと lastFilledAt が入る", !!lvl.lastFilledAt, `level=${lvl.level} lastFilledAt=${lvl.lastFilledAt?"有":"無"}`);

// --- ⑦ 同名のストックが2つある場合に重複表示しないか ---
await page.evaluate(async ()=>{
  await firebase.database().ref("families/fam1/stocks/dup1").set({name:"重複テスト",level:"out"});
  await firebase.database().ref("families/fam1/stocks/dup2").set({name:"重複テスト",level:"low"});
});
await sleep(600);
await page.click('[data-tab="requests"]'); await sleep(800);
const dupCount = (await names()).filter(n=>n==="重複テスト").length;
check("同名ストックが重複表示されない", dupCount<=1, `${dupCount}件`);

// --- ⑧ 不正な cycleDays を DB に直接入れても壊れないか ---
await page.evaluate(async ()=>{
  await firebase.database().ref("families/fam1/stocks/bad1").set({name:"不正周期",level:"ok",cycleDays:"abc",lastFilledAt:Date.now()-999});
  await firebase.database().ref("families/fam1/stocks/bad2").set({name:"ゼロ周期",level:"ok",cycleDays:0,lastFilledAt:Date.now()});
  await firebase.database().ref("families/fam1/stocks/bad3").set({name:"負の周期",level:"ok",cycleDays:-5,lastFilledAt:Date.now()});
});
await sleep(800);
check("不正な cycleDays でエラーが出ない", errs.length===0, errs.join(" | "));
check("不正な cycleDays の品は出さない", !(await card()).includes("不正周期"), "");

await page.screenshot({path:`${OUT}/bughunt.png`});

await t.finish();
