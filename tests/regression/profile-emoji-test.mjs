// プロフィールの絵文字アイコンピッカーの検証:
// 件数が増えたので、よく買うもののイラストピッカーと同じ考え方で
// 表情/どうぶつ/ひと/のりもの・すきなもの の4分類に見出しを付けて並べる。
// 自分のプロフィール（設定タブ）・新規プロフィール作成画面の両方で使い回す。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep, errs } = t;
const check = t.check;
await t.ready();

await page.click('[data-tab="settings"]'); await sleep(400);
await page.click('[data-acc="profile"] [data-acc-toggle]'); await sleep(400);

const grid = page.locator("#set-emoji-picker");
check("見出しが4つある（表情/どうぶつ/ひと/のりもの）", (await grid.locator(".icon-picker-group-hdr").count()) === 4);
const headers = await grid.locator(".icon-picker-group-hdr").allInnerTexts();
check("見出しの並び", headers.join(",") === "😀 表情,🐾 どうぶつ,🧑 ひと,🎈 のりもの・すきなもの", headers.join(","));
const total = await grid.locator("button").count();
check("60種類の絵文字がある（4分類の合計）", total === 60, String(total));

// 現在のプロフィール絵文字（fb-stub の既定値）がどれか1つだけ選択済みになっている
check("選択中の絵文字が1つだけハイライトされる", (await grid.locator("button.selected").count()) === 1);

// 「のりもの」分類から選ぶと選択が切り替わる
const carBtn = grid.locator("button", { hasText: "🚗" });
await carBtn.click();
await sleep(200);
check("タップすると選択がそちらに移る", await carBtn.evaluate((el) => el.classList.contains("selected")));
check("選択はやはり1つだけ", (await grid.locator("button.selected").count()) === 1);

// 更新して保存できる（エラーにならない）
await page.click("#btn-update-profile");
await sleep(500);

// 新規プロフィール作成画面（#emoji-picker）は renderEmojiPicker() を共用しているだけで、
// 通常のログイン済みフローでは描画されない（loadUserProfile() が「プロフィール未作成」の
// ときだけ呼ぶ）。ここでは同じ関数を直接呼び、同じ分類・件数で描けることだけ確認する
const setupInfo = await page.evaluate(() => {
  renderEmojiPicker("emoji-picker", "profileEmoji");
  const grid = document.getElementById("emoji-picker");
  return {
    headers: [...grid.querySelectorAll(".icon-picker-group-hdr")].map((h) => h.textContent),
    total: grid.querySelectorAll("button").length,
  };
});
check("新規プロフィール画面のピッカーも同じ4分類で描かれている", setupInfo.headers.length === 4, setupInfo.headers.join(","));
check("新規プロフィール画面も60種類", setupInfo.total === 60, String(setupInfo.total));

if (errs.length) console.log(errs);
await t.finish();
