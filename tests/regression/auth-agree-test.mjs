// ログイン画面の「ログイン/新規登録」切り替えと、新規登録時だけ必須になる
// 利用規約・プライバシーポリシー同意チェックの検証（docs/rules/ui.md の
// section-toggle-btn の教訓と同じく、独自の disabled ゲートは実際の見た目まで確認する）。
//
// テストスタブ（fb-stub.js）は常にログイン済み状態を返すため #screen-auth は
// 実際には表示されない。ここでは関数・DOM状態を直接検証する（window.state が
// 読めないのと同じ理由で、クラシックスクリプトのトップレベル関数は window に
// 乗るのでそちらを呼ぶ）。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

await page.goto(t.url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#screen-main", { state: "visible", timeout: 20000 });
await sleep(300);

const initial = await page.evaluate(() => ({
  signinActive: document.querySelector('#screen-auth .seg-btn[data-auth-mode="signin"]').classList.contains("active"),
  agreeRowDisplay: getComputedStyle(document.getElementById("auth-agree-row")).display,
  submitLabel: document.getElementById("btn-auth-submit").textContent,
  submitDisabled: document.getElementById("btn-auth-submit").disabled,
  googleDisabled: document.getElementById("btn-google").disabled,
}));
check("初期状態はログインタブ", initial.signinActive);
check("初期状態では同意チェックは隠れている", initial.agreeRowDisplay === "none");
check("初期状態のボタン文言はログイン", initial.submitLabel === "ログイン");
check("ログインタブでは送信ボタンが有効", !initial.submitDisabled);
check("ログインタブではGoogleボタンが有効", !initial.googleDisabled);

await page.evaluate(() => window.switchAuthMode("signup"));
await sleep(100);

const afterSignup = await page.evaluate(() => ({
  signupActive: document.querySelector('#screen-auth .seg-btn[data-auth-mode="signup"]').classList.contains("active"),
  agreeRowDisplay: getComputedStyle(document.getElementById("auth-agree-row")).display,
  submitLabel: document.getElementById("btn-auth-submit").textContent,
  googleLabel: document.getElementById("btn-google-label").textContent,
  submitDisabled: document.getElementById("btn-auth-submit").disabled,
  googleDisabled: document.getElementById("btn-google").disabled,
}));
check("新規登録タブに切り替わる", afterSignup.signupActive);
check("新規登録タブでは同意チェックが出る", afterSignup.agreeRowDisplay === "flex");
check("新規登録タブのボタン文言は新規登録", afterSignup.submitLabel === "新規登録");
check("Googleボタンの文言も新規登録用に変わる", afterSignup.googleLabel === "Googleで新規登録");
check("未同意だと送信ボタンは無効", afterSignup.submitDisabled);
check("未同意だとGoogleボタンも無効", afterSignup.googleDisabled);

// #screen-auth は常時ログイン済みのスタブでは非表示（display:none）のため
// 実測はできない。CSSで44px以上を確保していることを直接確認する。
const agreeMinHeight = await page.evaluate(() =>
  parseFloat(getComputedStyle(document.getElementById("auth-agree-row")).minHeight));
check("同意チェック行のタップ領域は44px以上", agreeMinHeight >= 44);

// チェックを入れる（#screen-auth は非表示のためPlaywrightの通常クリックは使えない。
// element.click() でネイティブのDOMクリック＋changeイベントを発火させて検証する）
await page.evaluate(() => document.getElementById("auth-agree").click());
await sleep(100);
const afterCheck = await page.evaluate(() => ({
  submitDisabled: document.getElementById("btn-auth-submit").disabled,
  googleDisabled: document.getElementById("btn-google").disabled,
}));
check("同意すると送信ボタンが有効になる", !afterCheck.submitDisabled);
check("同意するとGoogleボタンも有効になる", !afterCheck.googleDisabled);

// 外して再び無効化されることも確認
await page.evaluate(() => document.getElementById("auth-agree").click());
await sleep(100);
const afterUncheck = await page.evaluate(() => document.getElementById("btn-auth-submit").disabled);
check("同意を外すと再び無効になる", afterUncheck);

// disabled属性はEnterキー等のバイパス経路もあるため、関数側の二重ガードも直接確認する
await page.evaluate(() => window.signUpEmail());
await sleep(100);
const signupErr = await page.locator("#auth-error").innerText();
check("signUpEmail() 自体も未同意ならエラーで止まる", signupErr.includes("同意"));

await page.evaluate(() => window.signInGoogle());
await sleep(100);
const googleErr = await page.locator("#auth-error").innerText();
check("signInGoogle() も新規登録モード×未同意ならエラーで止まる", googleErr.includes("同意"));

// ログインタブに戻すと同意チェックはリセットされ、ゲートも外れる
await page.evaluate(() => window.switchAuthMode("signin"));
await sleep(100);
const afterBack = await page.evaluate(() => ({
  agreeRowDisplay: getComputedStyle(document.getElementById("auth-agree-row")).display,
  agreeChecked: document.getElementById("auth-agree").checked,
  submitDisabled: document.getElementById("btn-auth-submit").disabled,
}));
check("ログインタブに戻すと同意チェック行が隠れる", afterBack.agreeRowDisplay === "none");
check("ログインタブに戻すと同意チェックはリセットされる", !afterBack.agreeChecked);
check("ログインタブに戻すと送信ボタンは有効", !afterBack.submitDisabled);

await t.finish();
