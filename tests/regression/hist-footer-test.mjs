// 履歴の閉じるボタンが下部（店内モードと同じ位置感）にあり機能するか
import { startHarness } from "../harness.mjs";
const t = await startHarness();
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(900);

// 店内モードの終了ボタン位置を基準として取得
await page.click("#btn-store-mode"); await sleep(700);
const storeBtn = await page.locator("#btn-store-mode-close").boundingBox();
await page.click("#btn-store-mode-close"); await sleep(500);

// 履歴を開く
await page.click("#btn-history-float"); await sleep(800);
check("履歴が開く", await page.locator("#history-sheet.open").count()===1);
const histBtn = await page.locator("#btn-history-close").boundingBox();
check("閉じるボタンが画面内", histBtn.y+histBtn.height <= 844, `y=${Math.round(histBtn.y)}`);
check("画面下部にある", histBtn.y > 844*0.6, `y=${Math.round(histBtn.y)} / 844`);
check("店内モードの終了と同じ位置感（縦差40px以内）", Math.abs(histBtn.y-storeBtn.y) < 40,
  `履歴y=${Math.round(histBtn.y)} 店内y=${Math.round(storeBtn.y)} 差=${Math.round(Math.abs(histBtn.y-storeBtn.y))}`);
check("ヘッダーに旧✕が無い", await page.locator(".sheet-header #btn-history-close").count()===0);
check("タップ領域44px以上", histBtn.height>=44, Math.round(histBtn.height)+"px");
await page.screenshot({path:`${OUT}/h1-hist-footer.png`});

// スクロールしても位置固定・スクロール自体も動くか
const st0 = await page.evaluate(()=>document.querySelector("#history-sheet .sheet-content").scrollTop);
await t.swipeUp(195, 620, 260);
await sleep(700);
const st1 = await page.evaluate(()=>document.querySelector("#history-sheet .sheet-content").scrollTop);
check("履歴がスワイプでスクロールする", st1 > 20, `${st0} → ${Math.round(st1)}`);
const histBtn2 = await page.locator("#btn-history-close").boundingBox();
check("スクロール後も閉じるボタンが同位置", Math.abs(histBtn2.y-histBtn.y) < 2, `y=${Math.round(histBtn2.y)}`);
await page.screenshot({path:`${OUT}/h2-hist-scrolled.png`});

// 実タップで閉じる
await page.locator("#btn-history-close").tap();
await sleep(600);
check("タップで閉じられる", await page.locator("#history-sheet.open").count()===0);
// 背景タップでも閉じられる
await page.click("#btn-history-float"); await sleep(700);
await page.locator("#sheet-backdrop").tap({position:{x:195,y:40}});
await sleep(600);
check("背景タップでも閉じられる", await page.locator("#history-sheet.open").count()===0);

if(errs.length)fail++;

await t.finish();
