// 「そろそろ切れるかも」の期間指定（家族共通の予告日数＋品目ごとの買う間隔）の検証
import { startHarness } from "../harness.mjs";
const t = await startHarness({ dialogAnswer: "30" });
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;
const lowText=()=>page.locator(".lowstock-card").innerText().catch(()=>"");

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(1200);

// ---- 既定（2日前から） ----
let txt = await lowText();
check("既定でカードが出る", (await page.locator(".lowstock-card").count())===1);
check("既定では遠い品(ティッシュ箱買い・あと10日)は出ない", !txt.includes("ティッシュ箱買い"));
check("手入力の間隔(コンタクト洗浄液・あと1日)は履歴ゼロでも出る", txt.includes("コンタクト洗浄液"));
check("手入力は「約」を付けずに言い切る", /(?<!約)30日ごと/.test(txt), (txt.match(/[^\n]*30日ごと[^\n]*/)||[""])[0].trim());
const baseCount = await page.locator(".lowstock-item").count();

// ---- 設定タブ: 予告日数のセレクトがある ----
await page.click('[data-tab="settings"]');
await sleep(600);
check("設定に予告日数のセレクトがある", (await page.locator("#opt-low-lead").count())===1);
check("既定値は2日前", (await page.locator("#opt-low-lead").inputValue())==="2");
await page.screenshot({path:`${OUT}/ll-settings.png`});

// ---- 14日前に広げる ----
await page.selectOption("#opt-low-lead","14");
await sleep(800);
await page.click('[data-tab="requests"]');
await sleep(700);
txt = await lowText();
const wideCount = await page.locator(".lowstock-item").count();
check("広げると遠い品が出てくる", txt.includes("ティッシュ箱買い"), (txt.match(/[^\n]*ティッシュ箱買い[\s\S]{0,24}/)||[""])[0].replace(/\n/g,"／"));
check("件数が増える", wideCount>baseCount, `${baseCount} → ${wideCount}`);
await page.screenshot({path:`${OUT}/ll-wide.png`});

// ---- 0日（当日のみ）に狭める ----
await page.click('[data-tab="settings"]');
await sleep(500);
await page.selectOption("#opt-low-lead","0");
await sleep(800);
await page.click('[data-tab="requests"]');
await sleep(700);
txt = await lowText();
check("狭めると遠い品は消える", !txt.includes("ティッシュ箱買い"));
check("狭めても「あと1日」の品は消える", !txt.includes("コンタクト洗浄液"));
check("ストックの🔴🟡は予告日数に関係なく残る", txt.includes("ラップ")&&txt.includes("米"));

// 端末ローカルではなく DB（家族共通）に保存されていること。
// ※スタブはインメモリでリロード時に再シードされるため、リロードではなく DB を直接読む。
const saved = await page.evaluate(async () =>
  (await firebase.database().ref("families/fam1/settings/lowLeadDays").once("value")).val());
check("家族共通の設定としてDBに保存される", saved===0, `families/fam1/settings/lowLeadDays = ${JSON.stringify(saved)}`);

// 元に戻す
await page.click('[data-tab="settings"]');
await sleep(500);
await page.selectOption("#opt-low-lead","2");
await sleep(700);

// ---- 品目ごとの買う間隔をストック詳細から指定 ----
await page.click('[data-tab="stock"]');
await sleep(700);
const soy = page.locator(".stock-item").filter({hasText:"しょうゆ"}).first();
check("しょうゆのストックがある", (await soy.count())===1);
await soy.click();
await sleep(600);
check("詳細に買う間隔の入力がある", (await page.locator("#stock-detail-cycle").count())===1);
const hint = await page.locator("#stock-detail-body").innerText();
check("履歴が無い品は学習待ちの案内が出る", hint.includes("3回買うと自動で学習"), "");
await page.screenshot({path:`${OUT}/ll-stock-detail.png`});
await page.fill("#stock-detail-cycle","1");
await page.click("#btn-stock-detail-cycle");
await sleep(900);
const stockTxt = await page.locator("#stock-ok-section, #stock-low-section, #stock-out-section").allInnerTexts();
check("ストックカードに指定した間隔が出る", stockTxt.join(" ").includes("1日ごと"),
  (stockTxt.join(" ").match(/[^\s]*1日ごと[^\s]*/)||[""])[0]);

await page.click('[data-tab="requests"]');
await sleep(800);
txt = await lowText();
check("指定した品が「そろそろ切れるかも」に出る", txt.includes("しょうゆ"),
  (txt.match(/[^\n]*しょうゆ[\s\S]{0,24}/)||[""])[0].replace(/\n/g,"／"));
await page.screenshot({path:`${OUT}/ll-after-manual.png`});

// ---- 解除できる ----
await page.click('[data-tab="stock"]');
await sleep(700);
await page.locator(".stock-item").filter({hasText:"しょうゆ"}).first().click();
await sleep(600);
check("保存した値が入力欄に戻ってくる", (await page.locator("#stock-detail-cycle").inputValue())==="1");
await page.fill("#stock-detail-cycle","");
await page.click("#btn-stock-detail-cycle");
await sleep(900);
await page.click('[data-tab="requests"]');
await sleep(800);
txt = await lowText();
check("空で保存すると解除される", !txt.includes("しょうゆ"));

await t.finish();
