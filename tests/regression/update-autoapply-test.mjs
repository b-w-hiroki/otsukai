// 新バージョンを検知したときの「自動適用」の検証。
// 何か操作中（シートが開いている・入力欄にフォーカスがある）は自動更新を待ち、
// 安全なタイミング（何も開いておらず、入力欄にもフォーカスが無い）になってから
// 数秒おきの確認を経て自動でリロードされることを確かめる。
import { startHarness } from "../harness.mjs";
let SW_VERSION = "v40";
let APP_MARKER = "OLD";
const t = await startHarness({
  transform: (rel, text) => {
    if (rel === "sw.js") return text.replace(/const CACHE = "otsukai-[^"]+"/, `const CACHE = "otsukai-${SW_VERSION}"`);
    if (rel === "app-init.js") return text + `\n// build-marker: ${APP_MARKER}\nself.__BUILD='${APP_MARKER}';\n`;
    return null;
  },
});
const { url, page, sleep, OUT } = t;
const check = t.check;

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#screen-main", { state: "visible", timeout: 20000 });
await sleep(2000);
const build1 = await page.evaluate(() => self.__BUILD);
check("初回のビルド識別子", build1 === "OLD", build1);

// --- 追加シートを開いた状態（＝安全でないタイミング）にしておく ---
await page.click("#btn-add-float");
await sleep(500);
check("追加シートが開いている", await page.locator("#sheet-add.open").isVisible());

// --- 新バージョンをデプロイし、検知させる ---
SW_VERSION = "v41"; APP_MARKER = "NEW";
await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await sleep(2500);
await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  try { await reg.update(); } catch (e) {}
  await new Promise((r) => setTimeout(r, 2500));
});
check("新バージョン検知で更新バナーが出る", await page.locator("#update-banner").count() === 1);

// --- シートを開いたままなら、しばらく待っても自動更新されない ---
await sleep(9000); // 自動適用の確認間隔（8秒）をまたぐ
const buildStillOpen = await page.evaluate(() => self.__BUILD).catch(() => "reloaded");
check("シートを開いている間は自動更新されない", buildStillOpen === "OLD", buildStillOpen);
check("シートも開いたまま", await page.locator("#sheet-add.open").isVisible());

// --- シートを閉じる（＝安全なタイミングになる） ---
await page.click("#btn-sheet-close");
await sleep(500);
check("シートを閉じた", !(await page.locator("#sheet-add.open").isVisible()));

// --- 次の確認タイミング（8秒おき）で自動的に更新・リロードされる ---
await sleep(9000);
await page.waitForSelector("#screen-main", { state: "visible", timeout: 15000 });
await sleep(1500);
const build2 = await page.evaluate(() => self.__BUILD);
check("シートを閉じると自動で新しいコードに切り替わる（ボタン操作なし）", build2 === "NEW", `${build1} → ${build2}`);
check("自動更新後はバナーが消えている", await page.locator("#update-banner").count() === 0);
await page.screenshot({ path: `${OUT}/u-autoapply.png` });

await t.finish();
