// 「強制アップデート」のモーダルは、入力中やシートを開いている間は出さずに待ち、
// 安全なタイミング（何も開いておらず、入力欄にもフォーカスが無い）になってから
// 数秒おきの確認を経て表示されることを確かめる。表示された後は自動では進まず、
// 「アップデート」を押すまで待つ（それ自体は update-modal-test.mjs で検証）。
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

// --- シートを開いたままなら、しばらく待ってもモーダルは出ない ---
await sleep(9000); // 安全確認の間隔（8秒）をまたぐ
check("シートを開いている間は強制アップデートのモーダルが出ない", !(await page.locator("#update-modal.open").count()));
check("シートも開いたまま", await page.locator("#sheet-add.open").isVisible());
const buildStillOpen = await page.evaluate(() => self.__BUILD);
check("コードもまだ古いまま（勝手に更新されていない）", buildStillOpen === "OLD", buildStillOpen);

// --- シートを閉じる（＝安全なタイミングになる） ---
await page.click("#btn-sheet-close");
await sleep(500);
check("シートを閉じた", !(await page.locator("#sheet-add.open").isVisible()));

// --- 次の確認タイミング（8秒おき）で強制アップデートのモーダルが出る ---
await sleep(9000);
check("シートを閉じると強制アップデートのモーダルが出る", await page.locator("#update-modal.open").count() === 1);
check("押すまでは新しいコードに切り替わらない", (await page.evaluate(() => self.__BUILD)) === "OLD");
await page.screenshot({ path: `${OUT}/u-forced.png` });

// --- 「アップデート」を押すと切り替わる ---
await page.click("#btn-apply-update");
await page.waitForSelector("#screen-main", { state: "visible", timeout: 15000 });
await sleep(1500);
const build2 = await page.evaluate(() => self.__BUILD);
check("押すと自動で新しいコードに切り替わる", build2 === "NEW", `${build1} → ${build2}`);

await t.finish();
