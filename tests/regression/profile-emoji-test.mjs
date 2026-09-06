// プロフィールの絵文字アイコンピッカーの検証:
// 件数が増えたので、よく買うもののイラストピッカーと同じくボタンタブで
// 表情/どうぶつ/ひと/のりもの・すきなもの の4分類を切り替える。
// 自分のプロフィール（設定タブ）・新規プロフィール作成画面の両方で使い回す。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep, errs } = t;
const check = t.check;
await t.ready();

await page.click('[data-tab="settings"]'); await sleep(400);
await page.click('[data-acc="profile"] [data-acc-toggle]'); await sleep(400);

const tabs = page.locator("#set-emoji-picker-tabs .icon-picker-tab");
const grid = page.locator("#set-emoji-picker");
check("分類ぶんタブが並ぶ（表情/どうぶつ/ひと/のりもの）", (await tabs.count()) === 4, String(await tabs.count()));
const labels = await tabs.allInnerTexts();
check("タブの並び", labels.join(",") === "😀 表情,🐾 どうぶつ,🧑 ひと,🎈 のりもの・すきなもの", labels.join(","));
check("一覧の見出し（グループ内の重複表示）は出さない（タブが分類を表すため）", (await grid.locator(".icon-picker-group-hdr").count()) === 0);

// 現在のプロフィール絵文字（fb-stub の既定値。表情の😎）が入っている分類のタブが自動で選ばれ、
// その絵文字だけがハイライトされている
check("既定の絵文字が入っている「表情」タブが最初から選ばれている", await tabs.first().evaluate((el) => el.classList.contains("selected")));
check("選択中の絵文字が1つだけハイライトされる", (await grid.locator("button.selected").count()) === 1);
const faceCount = await page.evaluate(() => EMOJI_GROUPS.find((g) => g.key === "face").emojis.length);
check("表情タブの絵文字数ぶんボタンが並ぶ", (await grid.locator("button").count()) === faceCount, String(faceCount));

// --- 「のりもの」タブに切り替えると、その分類だけに変わる ---
await tabs.last().click();
await sleep(200);
check("タブを切り替えると選択中の表示になる", await tabs.last().evaluate((el) => el.classList.contains("selected")));
// タブの列は横スクロールする。長いラベル（のりもの・すきなもの）を選んでも、
// 端で切れて見えたままにならないよう、選んだタブ全体が見える位置までスクロールされる
const tabVisible = await page.evaluate(() => {
  const wrap = document.getElementById("set-emoji-picker-tabs");
  const sel = wrap.querySelector(".icon-picker-tab.selected");
  const wr = wrap.getBoundingClientRect(), sr = sel.getBoundingClientRect();
  return sr.left >= wr.left - 5 && sr.right <= wr.right + 5;
});
check("選んだタブが途中で切れずに見える位置までスクロールされる", tabVisible);
check("表情タブは選択中でなくなる", !(await tabs.first().evaluate((el) => el.classList.contains("selected"))));
const vehicleCount = await page.evaluate(() => EMOJI_GROUPS.find((g) => g.key === "other").emojis.length);
check("のりものタブの絵文字数ぶんに変わる", (await grid.locator("button").count()) === vehicleCount, String(vehicleCount));
check("切り替えた直後はどれも選択されていない（現在の絵文字は別分類のため）", (await grid.locator("button.selected").count()) === 0);

// --- タップすると選択が切り替わる ---
const carBtn = grid.locator("button", { hasText: "🚗" });
await carBtn.click();
await sleep(200);
check("タップすると選択がそちらに移る", await carBtn.evaluate((el) => el.classList.contains("selected")));
check("選択はやはり1つだけ", (await grid.locator("button.selected").count()) === 1);

// 更新して保存できる（エラーにならない）。保存の途中で「members」リスナー経由の
// 再描画が挟まっても、選んだ絵文字（🚗・のりもの）がきちんと保存され、
// ピッカーもその分類のタブに描き直される
await page.click("#btn-update-profile");
await sleep(500);
check("保存後のトーストが出る", (await page.locator("#toasts").innerText().catch(() => "")).includes("更新しました"));
check("保存後、選んだ絵文字が入っている分類のタブが選ばれている", await tabs.last().evaluate((el) => el.classList.contains("selected")));
check("その絵文字がハイライトされている", await carBtn.evaluate((el) => el.classList.contains("selected")));
const savedEmoji = await page.evaluate(async () => {
  const snap = await firebase.database().ref("families/fam1/members/uid-parent").once("value");
  return (snap.val() || {}).emoji;
});
check("DBにも選んだ絵文字が保存される（保存中の再描画で古い値に巻き戻らない）", savedEmoji === "🚗", savedEmoji);

// 新規プロフィール作成画面（#emoji-picker）は renderEmojiPicker() を共用しているだけで、
// 通常のログイン済みフローでは描画されない（loadUserProfile() が「プロフィール未作成」の
// ときだけ呼ぶ）。ここでは同じ関数を直接呼び、同じ分類数・タブで描けることだけ確認する
const setupInfo = await page.evaluate(() => {
  state.profileEmoji = "🙂"; // 表情タブの絵文字にしておく
  renderEmojiPicker("emoji-picker", "profileEmoji");
  const tabsEl = document.getElementById("emoji-picker-tabs");
  const gridEl = document.getElementById("emoji-picker");
  return {
    tabCount: tabsEl.querySelectorAll(".icon-picker-tab").length,
    selectedTab: tabsEl.querySelector(".icon-picker-tab.selected")?.textContent,
    selectedCount: gridEl.querySelectorAll("button.selected").length,
  };
});
check("新規プロフィール画面のピッカーも同じ4タブで描かれている", setupInfo.tabCount === 4, String(setupInfo.tabCount));
check("新規プロフィール画面も、絵文字が入っている分類のタブが選ばれる", setupInfo.selectedTab === "😀 表情", setupInfo.selectedTab);
check("新規プロフィール画面も選択が1つだけハイライトされる", setupInfo.selectedCount === 1);

if (errs.length) console.log(errs);
await t.finish();
