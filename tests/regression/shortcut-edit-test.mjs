// よく買うものの編集シート（編集モードでカード本体をタップして開く）を検証。
// カテゴリ必須化より前に登録された「カテゴリ無し」の項目でも、後から選び直せることが目的。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true, dialogAction: "dismiss" });
const { page, sleep } = t;
const check = t.check;

const shortcutNamed = async (name) =>
  page.evaluate(async (n) => {
    const snap = await firebase.database().ref("families/fam1/shortcuts").once("value");
    return Object.values(snap.val() || {}).find((s) => s && s.name === n);
  }, name);

await t.ready();
await page.click("#btn-shortcut-toggle");
await sleep(500);

// --- 編集モードに入る前は、カードタップで即クイック追加の確認ダイアログが出る ---
const milkCard = page.locator("#shortcut-sheet .shortcut-row, #shortcut-sheet .shortcut-card").filter({ hasText: "牛乳" }).first();
t.clearDialogs();
await milkCard.click();
await sleep(400);
check("編集モード前はクイック追加の確認ダイアログが出る", t.dialogs.some(d => d.includes("買い物リストに追加")));

// --- 編集モードに入ると、カテゴリが無い「ティッシュ」も編集シートで直せる ---
await page.click("#btn-shortcut-edit");
await sleep(500);
const tissueCard = page.locator("#shortcut-sheet .shortcut-row, #shortcut-sheet .shortcut-card").filter({ hasText: "ティッシュ" }).first();
await tissueCard.click();
await sleep(500);
check("編集シートが開く", await page.locator("#sheet-add.open").isVisible());
check("タイトルが編集になっている", (await page.locator("#sheet-add .sheet-title").innerText()).includes("編集"));
check("品名が入っている", await page.inputValue("#new-name") === "ティッシュ");
check("カテゴリ未設定なので、チップは何も選択されていない",
  (await page.locator("#new-category .cat-chip.selected").count()) === 0);

// カテゴリを選ばずに更新しようとするとブロックされる（追加時と同じ必須ルール）
await page.click("#btn-add-request");
await sleep(400);
const toast1 = await page.locator("#toasts").innerText().catch(() => "");
check("カテゴリ未選択だと更新をブロックする", toast1.includes("カテゴリを選んでください"), toast1);

// カテゴリを選んで更新する
await page.click('#new-category .cat-chip[data-cat="daily"]');
await page.click("#btn-add-request");
await sleep(800);
check("シートが閉じる", !(await page.locator("#sheet-add.open").isVisible()));
const tissue = await shortcutNamed("ティッシュ");
check("カテゴリが保存される", tissue && tissue.category === "daily", JSON.stringify(tissue));

// --- 既にカテゴリがある「牛乳」も、編集シートで選び直せる（他の項目は保持される） ---
// 更新後はシートが閉じているので開き直す（編集モード自体は維持されている）
await page.click("#btn-shortcut-toggle");
await sleep(500);
check("編集モードは維持されたまま再度開く", await page.locator("#btn-shortcut-edit.open").count() === 1);
const milkCard2 = page.locator("#shortcut-sheet .shortcut-row, #shortcut-sheet .shortcut-card").filter({ hasText: "牛乳" }).first();
await milkCard2.click();
await sleep(500);
check("既存のカテゴリが選択済みで開く",
  await page.locator('#new-category .cat-chip[data-cat="food"]').evaluate((el) => el.classList.contains("selected")));
await page.click('#new-category .cat-chip[data-cat="daily"]');
await page.click("#btn-add-request");
await sleep(800);
const milk = await shortcutNamed("牛乳");
check("カテゴリだけ変わり、予算などは保持される",
  milk && milk.category === "daily" && milk.budget === 300, JSON.stringify(milk));

await t.finish();
