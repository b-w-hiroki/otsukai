// 店内モードの終了ボタンが画面下部（親指の届く位置）にあり機能するか
import { startHarness } from "../harness.mjs";
const t = await startHarness();
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(900);

// 開始ボタンの位置を記録
const startBox = await page.locator("#btn-store-mode").boundingBox();
await page.click("#btn-store-mode"); await sleep(700);
check("店内モードが開く", await page.locator("#store-mode.open").count()===1);

const closeBox = await page.locator("#btn-store-mode-close").boundingBox();
const vh = 844;
check("終了ボタンが画面内", closeBox && closeBox.y+closeBox.height <= vh, `y=${Math.round(closeBox.y)} h=${Math.round(closeBox.height)}`);
check("終了ボタンが画面下部（下40%以内）", closeBox.y > vh*0.6, `y=${Math.round(closeBox.y)} / 画面${vh}`);
const dist = Math.abs((closeBox.y+closeBox.height/2) - (startBox.y+startBox.height/2));
check("開始ボタンの近く（縦150px以内）", dist < 150, `距離${Math.round(dist)}px（開始y=${Math.round(startBox.y)}）`);
check("ヘッダーに旧✕が無い", await page.locator(".store-mode-hdr #btn-store-mode-close").count()===0);
check("タップ領域が十分（高さ44px以上）", closeBox.height >= 44, Math.round(closeBox.height)+"px");
await page.screenshot({path:`${OUT}/s1-store-footer.png`});

// 長いリストでもフッターが隠れないか（スクロールしても固定）
await page.evaluate(()=>{document.getElementById("store-mode-body").scrollTop = 9999;});
await sleep(400);
const closeBox2 = await page.locator("#btn-store-mode-close").boundingBox();
check("スクロール後も同じ位置に固定", Math.abs(closeBox2.y-closeBox.y) < 2, `y=${Math.round(closeBox2.y)}`);

// 実タップで閉じる
await page.locator("#btn-store-mode-close").tap();
await sleep(600);
check("タップで店内モードを終了できる", await page.locator("#store-mode.open").count()===0);

if(errs.length)fail++;

await t.finish();
