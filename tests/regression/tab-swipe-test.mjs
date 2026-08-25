// ページ内タブ（お買い物/よく買うもの/支出・家計/ストック/設定）を左右スワイプで
// 切り替えられることの検証。ミッションはコア機能ではないため下部ナビから外し、
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
const btnOffset = (tabName) => page.evaluate((tab) => {
  const nav = document.querySelector(".bottom-nav");
  const btn = document.querySelector(`.bottom-nav button[data-tab="${tab}"]`);
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  return { x: btnRect.left - navRect.left, width: btnRect.width };
}, tabName);
const indicatorAligned = async (tabName) => {
  const ind = await indicatorState();
  const btn = await btnOffset(tabName);
  return Math.abs(ind.x - btn.x) < 1 && Math.abs(ind.width - btn.width) < 1;
};

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

// --- 左スワイプで次のタブへ（お買い物→よく買うもの→支出・家計→ストック→設定） ---
await t.swipeLeft(400, 320, 40);
await sleep(400);
check("左スワイプでよく買うものタブへ", (await activeTab()) === "tab-shortcuts");
check("下部ナビの選択状態も連動する", (await activeNavBtn()) === "shortcuts");

await t.swipeLeft(400, 320, 40);
await sleep(400);
check("左スワイプで支出タブへ", (await activeTab()) === "tab-expenses");

await t.swipeLeft(400, 320, 40);
await sleep(400);
check("左スワイプでストックタブへ", (await activeTab()) === "tab-stock");

// --- ストックタブ: 指の置き場所が丸レベルボタン（touch-action:manipulation の
// <button>）の上でも、横スワイプと判定した後は明示的に preventDefault して
// JS側の制御に確定させているので、引き続きタブが切り替わる
// （「フッターのストックから左右スライドが効かない」の再発防止） ---
const levelBtnBox = await page.locator(".stock-level-btn").first().boundingBox();
if (levelBtnBox) {
  const y = levelBtnBox.y + levelBtnBox.height / 2;
  await t.swipeLeft(y, 320, 40);
  await sleep(400);
  check("ストックの丸レベルボタンの上から始めても左スワイプで設定タブへ切り替わる",
    (await activeTab()) === "tab-settings");
} else {
  await t.swipeLeft(400, 320, 40);
  await sleep(400);
  check("左スワイプで設定タブへ", (await activeTab()) === "tab-settings");
}

// --- 端まで来たら折り返さない ---
await t.swipeLeft(400, 320, 40);
await sleep(400);
check("最後のタブでさらに左スワイプしても何も起きない", (await activeTab()) === "tab-settings");

// --- 右スワイプで前のタブへ ---
await t.swipeRight(400, 40, 320);
await sleep(400);
check("右スワイプでストックタブへ戻る", (await activeTab()) === "tab-stock");

await t.swipeRight(400, 40, 320);
await sleep(400);
check("右スワイプで支出タブへ戻る", (await activeTab()) === "tab-expenses");

await t.swipeRight(400, 40, 320);
await sleep(400);
check("右スワイプでよく買うものタブへ戻る", (await activeTab()) === "tab-shortcuts");

await t.swipeRight(400, 40, 320);
await sleep(400);
check("右スワイプを重ねてお買い物タブまで戻る", (await activeTab()) === "tab-requests");

await t.swipeRight(400, 40, 320);
await sleep(400);
check("最初のタブでさらに右スワイプしても何も起きない", (await activeTab()) === "tab-requests");

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
await page.click("#fab-add");
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
check("タップ後、背景がストックの位置に揃う", await indicatorAligned("stock"));
check("タップ後はドラッグ中扱いではない（アニメーション付きで動く）", !(await indicatorState()).dragging);

// --- スワイプ中は指の動きに合わせて背景が今のタブと隣のタブの間を追従する ---
// （お買い物が絡むドラッグは対象外。まずはお買い物以外の2タブ間で確認する）
await page.click('[data-tab="shortcuts"]');
await sleep(500);
const cdp2 = await t.ctx.newCDPSession(t.page);
const send2 = (type, x, y) => cdp2.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
await send2("touchStart", 320, 400);
await send2("touchMove", 300, 400); // dx=-20（閾値60の一部だけ動いた状態）
await sleep(100);
const midDrag = await indicatorState();
const homeOffset = await btnOffset("shortcuts");
const targetOffset = await btnOffset("expenses");
check("ドラッグ中はアニメーションを止めて指に追従する", midDrag.dragging);
check("閾値未満の途中では、背景が今のタブと隣のタブの間にある（まだどちらにも揃っていない）",
  midDrag.x > Math.min(homeOffset.x, targetOffset.x) && midDrag.x < Math.max(homeOffset.x, targetOffset.x),
  `home=${homeOffset.x} target=${targetOffset.x} mid=${midDrag.x}`);

// --- 閾値未満で指を離すと、背景は元のタブへ戻る（タブも切り替わらない） ---
await send2("touchEnd");
await cdp2.detach();
await sleep(500);
check("閾値未満で離すとタブは変わらない", (await activeTab()) === "tab-shortcuts");
check("背景も元の位置（よく買うもの）へ戻る", await indicatorAligned("shortcuts"));
check("戻った後はドラッグ中扱いが解除される", !(await indicatorState()).dragging);

// --- お買い物が絡むドラッグでは、背景は畳んだまま追従しない ---
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
