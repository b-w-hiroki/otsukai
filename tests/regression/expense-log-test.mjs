// 「その他の支出を記録」（お使いリスト以外の買い物ログ）とレシートOCRの検証。
// OCRは無料の端末内OCR（tesseract.js）を動的読み込みするため、実際のライブラリの
// 代わりに tests/ocr-stub.js を読み込ませ、window.__ocrStubText で読み取り結果を制御する。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

// 1x1 の透明PNG。ファイル選択の中身は問わない（スタブがOCR結果を返す）
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const pickReceipt = () => page.setInputFiles("#expense-receipt-input", { name: "receipt.png", mimeType: "image/png", buffer: PNG });

await t.ready();
await page.click('[data-tab="settings"]');
await sleep(500);
await page.click('.settings-acc[data-acc="monthly"] [data-acc-toggle]');
await sleep(400);

// --- 起動時は OCR SDK を読み込んでいない ---
const ocrLoadedBefore = await page.evaluate(() =>
  Array.from(document.scripts).some((s) => s.src.includes("tesseract")));
check("起動時は OCR SDK を読み込まない", !ocrLoadedBefore);

// --- シートが開く ---
check("「＋その他の支出を記録」ボタンがある", (await page.locator("#btn-open-expense-sheet").count()) === 1);
await page.click("#btn-open-expense-sheet");
await sleep(500);
check("シートが開く", await page.locator("#expense-sheet.open").isVisible());

// --- 金額なしで保存しようとするとエラー ---
await page.click("#btn-add-expense");
await sleep(400);
let toast = await page.locator("#toasts").innerText().catch(() => "");
check("金額が空だとエラーになる", toast.includes("金額を入力してください"));

// --- レシート写真を選ぶとOCRが動く（金額を検出できるケース） ---
await page.evaluate(() => { window.__ocrStubText = "小計 800円\n消費税  50円\n合計   850円"; });
await pickReceipt();
await sleep(800);
const ocrLoadedAfter = await page.evaluate(() =>
  Array.from(document.scripts).some((s) => s.src.includes("tesseract")));
check("写真を選ぶと OCR SDK が動的に読み込まれる", ocrLoadedAfter);
const status1 = await page.locator("#expense-receipt-status").innerText();
check("金額を検出してステータスに表示", status1.includes("850円を検出"), status1);
check("金額欄に自動入力される", (await page.locator("#expense-amount").inputValue()) === "850");

// --- 保存できる・一覧とサマリーに反映される ---
await page.fill("#expense-memo", "コンビニでお茶");
await page.click("#btn-add-expense");
await sleep(700);
toast = await page.locator("#toasts").innerText().catch(() => "");
check("記録できるとトーストが出る", toast.includes("850円を記録しました"), toast);
check("シートが閉じる", !(await page.locator("#expense-sheet.open").count()));
const listText = await page.locator("#extra-expense-list").innerText();
check("一覧に金額とメモが出る", listText.includes("850円") && listText.includes("コンビニでお茶"), listText.replace(/\n/g, "／"));
const summaryText = await page.locator("#monthly-summary").innerText();
check("今月のおかいものにその他の支出が合算される", summaryText.includes("850円") && summaryText.includes("その他の支出"), summaryText.replace(/\n/g, "／"));

// --- DBにも保存される（家族共有） ---
const saved = await page.evaluate(async () => {
  const snap = await firebase.database().ref("families/fam1/extraExpenses").once("value");
  const val = snap.val() || {};
  return Object.values(val);
});
check("DBに amount/addedBy/addedAt が保存される", saved.length === 1 && saved[0].amount === 850 && !!saved[0].addedBy && !!saved[0].addedAt,
  JSON.stringify(saved));

// --- 金額を検出できないケースは金額欄を書き換えない ---
await page.click("#btn-open-expense-sheet");
await sleep(500);
await page.evaluate(() => { window.__ocrStubText = "ありがとうございました またお越しください"; });
await pickReceipt();
await sleep(800);
const status2 = await page.locator("#expense-receipt-status").innerText();
check("検出できないときは案内文になる", status2.includes("検出できませんでした"), status2);
check("金額欄は空のまま", (await page.locator("#expense-amount").inputValue()) === "");

// --- 手入力でも保存できる（OCRを使わない場合） ---
await page.fill("#expense-amount", "300");
await page.click("#btn-add-expense");
await sleep(700);
const listText2 = await page.locator("#extra-expense-list").innerText();
check("手入力でも保存できる", listText2.includes("300円"), listText2.replace(/\n/g, "／"));

// --- ×で削除できる（確認ダイアログが出る） ---
const beforeCount = (await page.evaluate(async () =>
  Object.keys((await firebase.database().ref("families/fam1/extraExpenses").once("value")).val() || {}).length));
await page.click("[data-del-expense]");
await sleep(700);
const afterCount = (await page.evaluate(async () =>
  Object.keys((await firebase.database().ref("families/fam1/extraExpenses").once("value")).val() || {}).length));
check("削除するとDBからも消える", afterCount === beforeCount - 1, `${beforeCount} → ${afterCount}`);
check("削除に確認ダイアログが出る", t.dialogs.some((d) => d.includes("削除")), t.dialogs.join("／"));

await t.finish();
