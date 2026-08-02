// 新バージョンをデプロイした状況を再現し、更新バナー→更新→反映まで検証
import { startHarness } from "../harness.mjs";
let SW_VERSION = "v29";   // サーバーが返す sw.js の版。テスト中に上げてデプロイを再現する
let APP_MARKER = "OLD";   // app-init.js に埋める識別子。更新後に NEW へ変わったかを見る
const t = await startHarness({
  transform: (rel, text) => {
    if (rel === "sw.js") return text.replace(/const CACHE = "otsukai-[^"]+"/, `const CACHE = "otsukai-${SW_VERSION}"`);
    // app-init.js は分割後も最後に読み込まれるファイル（index.html の <script> 順）。
    // ここにマーカーを埋めれば「全 app-*.js の読み込みが完了したか」の確認になる。
    if (rel === "app-init.js") return text + `\n// build-marker: ${APP_MARKER}\nself.__BUILD='${APP_MARKER}';\n`;
    return null;
  },
});
const { url, browser, ctx, page, errs, sleep, OUT } = t;
const check = t.check;

// --- 1回目: v29 で起動 ---
await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(2000);
check("初回: SWが制御している", await page.evaluate(()=>!!navigator.serviceWorker.controller));
check("初回: バナーは出ていない", await page.locator("#update-banner").count()===0);
const build1 = await page.evaluate(()=>self.__BUILD);
check("初回のビルド識別子", build1==="OLD", build1);

// --- 新バージョンをデプロイ ---
SW_VERSION = "v30"; APP_MARKER = "NEW";
// アプリに戻ったときの更新チェックを発火（visibilitychange）
await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
await sleep(3000);
// 診断: 登録状態と sw.js の実体を確認
const diag = await page.evaluate(async()=>{
  const reg = await navigator.serviceWorker.getRegistration();
  const r = await fetch("./sw.js", {cache:"no-store"});
  const txt = await r.text();
  const m = txt.match(/const CACHE = "([^"]+)"/);
  return { servedVersion: m && m[1],
    installing: reg?.installing?.state || null,
    waiting: reg?.waiting?.state || null,
    active: reg?.active?.state || null,
    hasController: !!navigator.serviceWorker.controller };
});
console.log("  [診断]", JSON.stringify(diag));
// 明示的に update() を呼んでみる
const upd = await page.evaluate(async()=>{
  const reg = await navigator.serviceWorker.getRegistration();
  try { await reg.update(); } catch(e) { return "update error: "+e.message; }
  await new Promise(r=>setTimeout(r,2500));
  return { installing: reg.installing?.state||null, waiting: reg.waiting?.state||null, active: reg.active?.state||null };
});
console.log("  [update()後]", JSON.stringify(upd));
check("新バージョン検知で更新バナーが出る", await page.locator("#update-banner").count()===1);
await page.screenshot({path:`${OUT}/u3-update-banner.png`});
const bannerText = await page.locator("#update-banner").innerText().catch(()=>"");
check("バナー文言", bannerText.includes("新しいバージョン"), bannerText.replace(/\n/g," "));

// --- 「更新する」を押す → 再読み込みされて新コードになる ---
await page.locator("#btn-apply-update").click();
await page.waitForSelector("#screen-main",{state:"visible",timeout:25000});
await sleep(2500);
const build2 = await page.evaluate(()=>self.__BUILD);
check("更新後に新しいコードが読み込まれる", build2==="NEW", `${build1} → ${build2}`);
const ver = await page.evaluate(()=>new Promise(res=>{
  const h=e=>{if(e.data?.type==="VERSION"){navigator.serviceWorker.removeEventListener("message",h);res(e.data.version);}};
  navigator.serviceWorker.addEventListener("message",h);
  navigator.serviceWorker.controller?.postMessage({type:"GET_VERSION"});
  setTimeout(()=>res("timeout"),3000);
}));
check("SWのバージョンも上がっている", ver==="otsukai-v30", ver);
check("更新後はバナーが消えている", await page.locator("#update-banner").count()===0);

await t.finish();
