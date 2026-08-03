// 更新機構・PTR・メンテナンスボタンの検証（SWは実際に登録される http サーバで）
import { startHarness } from "../harness.mjs";
const t = await startHarness({ dialogAction: "dismiss" });
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(1500);

// SW が登録されたか
const swState = await page.evaluate(async()=>{
  const regs = await navigator.serviceWorker.getRegistrations();
  return { count: regs.length, controller: !!navigator.serviceWorker.controller,
           active: regs[0]?.active?.state || null };
});
check("Service Worker が登録される", swState.count >= 1, JSON.stringify(swState));

// メンテナンスボタンが存在（アコーディオンを開く）
await page.click('[data-tab="settings"]'); await sleep(600);
await page.click('.settings-acc[data-acc="maintenance"] [data-acc-toggle]'); await sleep(400);
for (const id of ["btn-refresh-data","btn-force-update","btn-force-signout"]) {
  check(`${id} が存在`, await page.locator("#"+id).count()===1);
}
await page.locator("#btn-refresh-data").scrollIntoViewIfNeeded(); await sleep(300);
await page.screenshot({path:`${OUT}/u1-maintenance.png`});

// バージョン表示（SWのcontrollerがある場合）
const ver = await page.locator("#app-version").textContent();
check("バージョンが表示される", ver && ver !== "—", ver);

// 「データを再読み込み」が動く（トースト確認）
await page.locator("#btn-refresh-data").click();
await sleep(1500);
const toast = await page.locator("#toasts").innerText().catch(()=>"");
check("データ再読み込みでトースト", toast.includes("更新"), toast.replace(/\n/g," ").slice(0,40));

// 破壊的ボタンは確認ダイアログが出る（dismissするので実行されない）
t.clearDialogs();
await page.locator("#btn-force-update").click(); await sleep(500);
check("アプリ更新に確認ダイアログ", t.dialogs.some(d=>d.includes("最新版")), t.dialogs[0]?.slice(0,30)||"なし");
t.clearDialogs();
await page.locator("#btn-force-signout").click(); await sleep(500);
check("強制ログアウトに確認ダイアログ", t.dialogs.some(d=>d.includes("ログアウト")), t.dialogs[0]?.slice(0,30)||"なし");

// スライドで更新（お買い物タブの最上部から下に引っ張る）
await page.click('[data-tab="requests"]'); await sleep(600);
await page.evaluate(()=>window.scrollTo(0,0)); await sleep(300);
await t.swipeDown(195, 200, 400);
await sleep(1800);
const toast2 = await page.locator("#toasts").innerText().catch(()=>"");
check("スライドで更新が動く", toast2.includes("最新の状態"), toast2.replace(/\n/g," ").slice(0,40));
await page.screenshot({path:`${OUT}/u2-after-ptr.png`});

if(errs.length)fail++;

await t.finish();
