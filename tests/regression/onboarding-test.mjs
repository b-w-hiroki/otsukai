// 初回オンボーディング（使い方＋ホーム画面追加の案内、app-init.js）を検証。
// 「ようこそ」「ホーム画面に追加」はカード、間の3ステップ（＋追加／ストック／ミッション）は
// 実ボタンを暗転の中で光らせるスポットライト演出（ソシャゲのチュートリアル風）。
// harness.mjs は他の回帰テストが毎回このモーダルにブロックされないよう、既定で
// localStorage.onboardingSeen = "1"（初期化スクリプトで毎回上書き）にしている。
// そのため「初回」の再現は、コンテキストレベルの初期化スクリプトでそのフラグを
// 消してから t.ready() する（reload だと harness の初期化スクリプトが毎回 "1" に
// 戻してしまうため、通常のテスト中は reload を使わない）。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

await t.ctx.addInitScript(() => localStorage.removeItem("onboardingSeen"));
await t.ready();

check("初回はカード（ようこそ）が自動で開く",
  await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open")));
check("1ページ目（ようこそ）が表示されている",
  await page.locator('.onboarding-page[data-step="0"]').evaluate((el) => el.classList.contains("active")));

// --- ステップ1: ＋追加ボタンのスポットライト ---
await page.click("#btn-onboarding-next");
await sleep(400);
check("カードは閉じる", !(await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open"))));
check("スポットライトが開く（＋追加）",
  await page.locator("#onboarding-spot-tip").evaluate((el) => el.classList.contains("open")));
check("見出しに「追加」が入っている",
  (await page.locator("#onboarding-spot-title").innerText()).includes("追加"));
check("光らせている枠は実際の＋追加ボタンの位置に重なっている", await page.evaluate(() => {
  const ring = document.getElementById("onboarding-spot-ring").getBoundingClientRect();
  const btn = document.getElementById("btn-add-float").getBoundingClientRect();
  return Math.abs(ring.left - btn.left) < 20 && Math.abs(ring.top - btn.top) < 20;
}));

// 本物の＋追加ボタンを直接タップ → 暗転を突き破って本物の操作として機能することを確認
await page.click("#btn-add-float");
await sleep(300);
check("本物のタップが本物の追加シートを開く（暗転に阻まれない）",
  await page.locator("#sheet-add").evaluate((el) => el.classList.contains("open")));
await page.click("#btn-sheet-close");
await sleep(900);

// --- ステップ2: ストックタブのスポットライト ---
check("シートを閉じるとステップ2（ストック）へ自動で進む",
  (await page.locator("#onboarding-spot-title").innerText()).includes("ストック"));
await page.click('.bottom-nav button[data-tab="stock"]');
await sleep(700);
check("本物のタップで実際にストックタブへ切り替わる",
  await page.locator("#tab-stock").evaluate((el) => el.classList.contains("active")));

// --- ステップ3: ミッションボタンのスポットライト ---
check("ステップ3（ミッション）へ自動で進む",
  (await page.locator("#onboarding-spot-title").innerText()).includes("ミッション"));
// 今度は本物をタップせず、吹き出しの「次へ」で進める
await page.click("#btn-onboarding-spot-next");
await sleep(900);

// --- ステップ4: ホーム画面に追加（カード） ---
check("最後はカード（ホーム画面に追加）に戻る",
  await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open")));
check("最後のステップに案内文が入っている",
  (await page.locator("#onboarding-install-body").innerText()).length > 0);
check("最後のボタンは「はじめる」になる",
  (await page.locator("#btn-onboarding-next").innerText()) === "はじめる");

await page.click("#btn-onboarding-next");
await sleep(300);
check("「はじめる」で全部閉じる",
  !(await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open"))) &&
  !(await page.locator("#onboarding-spot-tip").evaluate((el) => el.classList.contains("open"))));
check("見た記録が端末（localStorage）に残る",
  (await page.evaluate(() => localStorage.getItem("onboardingSeen"))) === "1");

// もう一度呼んでも（再ログイン・再接続等）、見た後なら再表示されないことを確認
await page.evaluate(() => maybeShowOnboarding());
await sleep(200);
check("見た後は同じセッション内で再度呼んでも開かない",
  !(await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open"))));

// --- スキップでも同様に閉じて記録されることを確認（スポットライト中のスキップ） ---
await page.evaluate(() => { localStorage.removeItem("onboardingSeen"); maybeShowOnboarding(); });
await sleep(200);
await page.click("#btn-onboarding-next"); // ようこそ → スポットライトへ
await sleep(400);
check("スキップ前提: スポットライトが開いている",
  await page.locator("#onboarding-spot-tip").evaluate((el) => el.classList.contains("open")));
await page.click("#btn-onboarding-spot-skip");
await sleep(200);
check("スポットライト中のスキップでも閉じる",
  !(await page.locator("#onboarding-spot-tip").evaluate((el) => el.classList.contains("open"))));
check("スキップでも記録される",
  (await page.evaluate(() => localStorage.getItem("onboardingSeen"))) === "1");

await t.finish();
