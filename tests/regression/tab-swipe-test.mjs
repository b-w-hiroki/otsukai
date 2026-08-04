// ページ内タブ（お買い物/ミッション/ストック/設定）を左右スワイプで切り替えられることの検証。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

const activeTab = () => page.evaluate(() => document.querySelector(".tab.active")?.id);
const activeNavBtn = () => page.evaluate(() => document.querySelector(".bottom-nav button.active")?.dataset.tab);

await t.ready();
check("最初はお買い物タブ", (await activeTab()) === "tab-requests");

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

await t.finish();
