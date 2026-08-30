// 初回オンボーディング（使い方＋ホーム画面追加の案内、app-init.js）を検証。
// 「ようこそ」「ホーム画面に追加」はカード、間の3ステップ（＋追加／ストック／ミッション）は
// 実ボタンを暗転の中で光らせるスポットライト演出（ソシャゲのチュートリアル風）。
//
// 見た/見てないは端末ではなく**アカウント単位**（users/{uid}/onboardingSeen、RTDB）で
// 管理している。fb-stub.js の既定データは「見た後」（true）にしてあり（他の回帰テストが
// 毎回ブロックされないため）、このテストだけ state.onboardingSeen を直接 false に戻して
// 「初回」を再現する。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

await t.ready();
check("既定（見た後）ではオンボーディングは出ない",
  !(await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open"))));

// --- 初回を再現 ---
await page.evaluate(() => { state.onboardingSeen = false; maybeShowOnboarding(); });
await sleep(200);
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
check("見た記録がアカウント（state.onboardingSeen）に残る",
  await page.evaluate(() => state.onboardingSeen) === true);
check("見た記録がDB（users/{uid}/onboardingSeen）にも保存される", await page.evaluate(async () => {
  const snap = await firebase.database().ref("users/uid-parent/onboardingSeen").once("value");
  return snap.val() === true;
}));

// もう一度呼んでも（再ログイン・再接続等）、見た後なら再表示されないことを確認
await page.evaluate(() => maybeShowOnboarding());
await sleep(200);
check("見た後は同じセッション内で再度呼んでも開かない",
  !(await page.locator("#onboarding-modal").evaluate((el) => el.classList.contains("open"))));

// --- スキップでも同様に閉じて記録されることを確認（スポットライト中のスキップ） ---
await page.evaluate(() => { state.onboardingSeen = false; maybeShowOnboarding(); });
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
  await page.evaluate(() => state.onboardingSeen) === true);

await t.finish();
