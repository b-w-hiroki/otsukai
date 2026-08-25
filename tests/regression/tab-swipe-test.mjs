// ページ内タブ（ストック/お買い物/設定）を左右スワイプで切り替えられることの検証。
// よく買うもの・支出は下部タブを廃止した（買い物ページのシート／プレイヤー情報シートに
// 一本化）ため対象外。ミッションもコア機能ではないため下部ナビから外し、
// トップバーのサイドボタン（名前と？の間）に移した。スワイプの対象にも含めない。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

const activeTab = () => page.evaluate(() => document.querySelector(".tab.active")?.id);
const activeNavBtn = () => page.evaluate(() => document.querySelector(".bottom-nav button.active")?.dataset.tab);
// 下部ナビの「スライドする背景」が、指定したタブのボタンの実際の位置・幅と揃っているか
const indicatorState = () => page.evaluate(() => {
  const nav = document.querySelector(".bottom-nav");
  const indicator = document.querySelector(".bottom-nav-indicator");
  const navRect = nav.getBoundingClientRect();
  const style = getComputedStyle(indicator);
  const m = new DOMMatrixReadOnly(style.transform);
  return { x: m.m41, width: parseFloat(style.width), dragging: indicator.classList.contains("dragging"), navLeft: navRect.left };
});

await t.ready();
check("最初はお買い物タブ", (await activeTab()) === "tab-requests");
// お買い物は中央の丸ボタン（独立した見た目）なので、スライドする背景の対象にせず畳んだままにする
check("初期表示では下部ナビの背景が畳まれている（お買い物は独立ボタンのため）", (await indicatorState()).width === 0);

// --- touch-action: pan-y が付いている ---
// 「特定のタブ以外でスワイプが効かない」不具合の実体は、縦にスクロールできる
// ページだとブラウザが横方向の指の動きも縦スクロールの一部として先取りしてしまい、
// JS側の touchmove まで届かないというもの。
// CDPの疑似タッチはこのブラウザ側のジェスチャー奪い合いを再現できないため、
// 実際に効いているかは touch-action の指定そのものを確認する。
const appTouchAction = await page.evaluate(() => getComputedStyle(document.querySelector(".app")).touchAction);
check("縦スクロールできる画面でもスワイプが横取りされないよう touch-action: pan-y が指定されている",
  appTouchAction === "pan-y", appTouchAction);

// --- ミッションは下部ナビには無く、トップバーのサイドボタンから開く ---
check("下部ナビにミッションのボタンは無い", (await page.locator('.bottom-nav button[data-tab="missions"]').count()) === 0);
check("トップバーにミッションのサイドボタンがある（名前と？の間）", (await page.locator("#btn-missions-nav").count()) === 1);
await page.click("#btn-missions-nav");
await sleep(500);
check("トップバーのボタンでミッションタブが開く", (await activeTab()) === "tab-missions");
check("ミッション表示中は下部ナビの背景が畳まれる（対応するボタンが無いため）", (await indicatorState()).width === 0);
const missionsBtnBox = await page.locator("#btn-missions-nav").boundingBox();
check("ミッションのサイドボタンのタップ領域が44px以上",
  missionsBtnBox.width >= 44 && missionsBtnBox.height >= 44,
  `${Math.round(missionsBtnBox.width)}x${Math.round(missionsBtnBox.height)}`);
await page.click('[data-tab="requests"]');
await sleep(500);

// --- 左スワイプで次のタブへ（お買い物→設定。下部ナビの並びはストック・お買い物・設定の3つ） ---
await t.swipeLeft(400, 320, 40);
await sleep(400);
check("左スワイプで設定タブへ", (await activeTab()) === "tab-settings");
check("下部ナビの選択状態も連動する", (await activeNavBtn()) === "settings");

// --- 端まで来たら折り返さない ---
await t.swipeLeft(400, 320, 40);
await sleep(400);
check("最後のタブでさらに左スワイプしても何も起きない", (await activeTab()) === "tab-settings");

// --- 右スワイプで前のタブへ ---
await t.swipeRight(400, 40, 320);
await sleep(400);
check("右スワイプでお買い物タブへ戻る", (await activeTab()) === "tab-requests");

await t.swipeRight(400, 40, 320);
await sleep(400);
check("右スワイプでストックタブへ", (await activeTab()) === "tab-stock");

// --- 端まで来たら折り返さない（逆方向） ---
await t.swipeRight(400, 40, 320);
await sleep(400);
check("最初のタブでさらに右スワイプしても何も起きない", (await activeTab()) === "tab-stock");

// --- ストックタブ: 指の置き場所が丸レベルボタン（touch-action:manipulation の
// <button>）の上でも、横スワイプと判定した後は明示的に preventDefault して
// JS側の制御に確定させているので、引き続きタブが切り替わる
// （「フッターのストックから左右スライドが効かない」の再発防止） ---
const levelBtnBox = await page.locator(".stock-level-btn").first().boundingBox();
if (levelBtnBox) {
  const y = levelBtnBox.y + levelBtnBox.height / 2;
  await t.swipeLeft(y, 320, 40);
  await sleep(400);
  check("ストックの丸レベルボタンの上から始めても左スワイプでお買い物タブへ切り替わる",
    (await activeTab()) === "tab-requests");
} else {
  await t.swipeLeft(400, 320, 40);
  await sleep(400);
  check("左スワイプでお買い物タブへ", (await activeTab()) === "tab-requests");
}

// --- 移動量が小さいときは切り替わらない ---
await t.swipeLeft(400, 320, 280);
await sleep(400);
check("わずかな移動では切り替わらない", (await activeTab()) === "tab-requests");

// --- 縦方向優位のドラッグ（スクロール）はタブを切り替えない ---
await page.evaluate(() => window.scrollTo(0, 0));
const cdp = await t.ctx.newCDPSession(t.page);
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 300 }] });
await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 150, y: 500 }] });
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await cdp.detach();
await sleep(400);
check("縦優位のドラッグではタブが切り替わらない", (await activeTab()) === "tab-requests");

// --- シートが開いている間はスワイプでタブが切り替わらない ---
await page.click("#btn-add-float");
await sleep(500);
await t.swipeLeft(400, 320, 40);
await sleep(400);
check("追加シートを開いている間はスワイプが効かない", (await activeTab()) === "tab-requests");
check("シートも開いたまま", await page.locator("#sheet-add.open").isVisible());
await page.click("#btn-sheet-close");
await sleep(400);

// --- 店内モード中もスワイプでタブが切り替わらない ---
await page.click("#btn-store-mode");
await sleep(600);
await t.swipeLeft(400, 320, 40);
await sleep(400);
check("店内モード中はスワイプが効かない", (await activeTab()) === "tab-requests");
check("店内モードも開いたまま", await page.locator("#store-mode.open").isVisible());
await page.click("#btn-store-mode-close");
await sleep(400);

// --- スワイプ後も通常のボタンでのタブ切替は引き続き動く ---
await page.click('[data-tab="stock"]');
await sleep(400);
check("ボタンでのタブ切替も引き続き動く", (await activeTab()) === "tab-stock");

// --- タップで切り替えたときも、下部ナビの背景が新しい位置へ滑る ---
await sleep(500); // トランジション完了を待つ
const stockBtnBox = await page.evaluate(() => {
  const nav = document.querySelector(".bottom-nav");
  const btn = document.querySelector('.bottom-nav button[data-tab="stock"]');
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  return { x: btnRect.left - navRect.left, width: btnRect.width };
});
const indAfterTap = await indicatorState();
check("タップ後、背景がストックの位置に揃う",
  Math.abs(indAfterTap.x - stockBtnBox.x) < 1 && Math.abs(indAfterTap.width - stockBtnBox.width) < 1);
check("タップ後はドラッグ中扱いではない（アニメーション付きで動く）", !indAfterTap.dragging);

// --- お買い物が絡むドラッグ（下部ナビが3タブしか無いため、隣り合うタブは常に
// お買い物のどちらかを含む）では、背景は畳んだまま指の動きに追従しない ---
await page.click('[data-tab="requests"]');
await sleep(500);
const cdp3 = await t.ctx.newCDPSession(t.page);
const send3 = (type, x, y) => cdp3.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
await send3("touchStart", 320, 400);
await send3("touchMove", 280, 400); // dx=-40（閾値未満。タブは切り替わらない）
await sleep(100);
check("お買い物が絡むドラッグ中は背景が畳まれたまま", (await indicatorState()).width === 0);
await send3("touchEnd");
await cdp3.detach();
await sleep(500);
check("お買い物が絡むドラッグの後も背景は畳まれたまま", (await indicatorState()).width === 0);
check("お買い物が絡むドラッグの後もタブは変わらない", (await activeTab()) === "tab-requests");

await t.finish();
