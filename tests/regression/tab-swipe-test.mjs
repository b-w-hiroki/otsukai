// ページ内タブ（お買い物/ミッション/ストック/設定）を左右スワイプで切り替えられることの検証。
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
check("初期表示で下部ナビの背景が「お買い物」の位置に揃っている", await indicatorAligned("requests"));

// --- touch-action: pan-y が付いている ---
// 「ミッションタブ以外でスワイプが効かない」不具合の実体は、縦にスクロールできる
// ページ（お買い物・ストック・設定）だとブラウザが横方向の指の動きも縦スクロールの
// 一部として先取りしてしまい、JS側の touchmove まで届かないというもの
// （ミッションタブは元々縦が短くスクロール自体が要らないため症状が出にくかった）。
// CDPの疑似タッチはこのブラウザ側のジェスチャー奪い合いを再現できないため、
// 実際に効いているかは touch-action の指定そのものを確認する。
const appTouchAction = await page.evaluate(() => getComputedStyle(document.querySelector(".app")).touchAction);
check("縦スクロールできる画面でもスワイプが横取りされないよう touch-action: pan-y が指定されている",
  appTouchAction === "pan-y", appTouchAction);

// --- 左スワイプで次のタブへ（お買い物→ミッション→ストック→設定） ---
await t.swipeLeft(400, 320, 40);
await sleep(400);
check("左スワイプでミッションタブへ", (await activeTab()) === "tab-missions");
check("下部ナビの選択状態も連動する", (await activeNavBtn()) === "missions");

await t.swipeLeft(400, 320, 40);
await sleep(400);
check("左スワイプでストックタブへ", (await activeTab()) === "tab-stock");

await t.swipeLeft(400, 320, 40);
await sleep(400);
check("左スワイプで設定タブへ", (await activeTab()) === "tab-settings");

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
await page.click('[data-tab="requests"]');
await sleep(500);
const cdp2 = await t.ctx.newCDPSession(t.page);
const send2 = (type, x, y) => cdp2.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
await send2("touchStart", 320, 400);
await send2("touchMove", 300, 400); // dx=-20（閾値60の一部だけ動いた状態）
await sleep(100);
const midDrag = await indicatorState();
const homeOffset = await btnOffset("requests");
const targetOffset = await btnOffset("missions");
check("ドラッグ中はアニメーションを止めて指に追従する", midDrag.dragging);
check("閾値未満の途中では、背景が今のタブと隣のタブの間にある（まだどちらにも揃っていない）",
  midDrag.x > Math.min(homeOffset.x, targetOffset.x) && midDrag.x < Math.max(homeOffset.x, targetOffset.x),
  `home=${homeOffset.x} target=${targetOffset.x} mid=${midDrag.x}`);

// --- 閾値未満で指を離すと、背景は元のタブへ戻る（タブも切り替わらない） ---
await send2("touchEnd");
await cdp2.detach();
await sleep(500);
check("閾値未満で離すとタブは変わらない", (await activeTab()) === "tab-requests");
check("背景も元の位置（お買い物）へ戻る", await indicatorAligned("requests"));
check("戻った後はドラッグ中扱いが解除される", !(await indicatorState()).dragging);

await t.finish();
