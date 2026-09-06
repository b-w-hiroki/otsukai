// ストック登録シートの「任意項目の折りたたみ」の検証（おつかい追加シートと同じ考え方）:
// 開いた直後は商品名・カテゴリ・写真・残量・追加ボタンが見え、
// 任意項目（行き先・メモ・予算・買う間隔）は押すまで隠れている。
// 追加ボタンはシート下部に固定され、小さい画面でもスクロールせずに押せる。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep, errs } = t;
const check = t.check;

// 小さい端末（iPhone SE 相当）で「ファーストビューに収まる」ことを見る
await page.setViewportSize({ width: 375, height: 667 });
await t.ready();

await page.click('[data-tab="stock"]'); await sleep(500);
await page.click("#btn-stock-register"); await sleep(500);
check("登録シートが開く", await page.locator("#stock-sheet.open").isVisible());

// --- 閉じた状態: 必須項目と主操作だけ ---
const toggle = page.locator("#btn-stock-more-fields");
check("「くわしく設定」ボタンがある", await toggle.isVisible());
const tb = await toggle.boundingBox();
check("ボタンのタップ領域は44px以上", tb && tb.height >= 44, tb ? `${tb.width}x${tb.height}` : "none");
check("最初は閉じている（aria-expanded=false）", (await toggle.getAttribute("aria-expanded")) === "false");
check("任意項目は隠れている", !(await page.locator("#stock-more-fields").isVisible()));
for (const id of ["stock-memo", "stock-budget", "stock-cycle"]) {
  check(`#${id} は見えない`, !(await page.locator("#" + id).isVisible()));
}
check("商品名は見える", await page.locator("#stock-name").isVisible());
check("カテゴリは見える", await page.locator("#stock-category").isVisible());
check("写真はカテゴリと同じく最初から見える", await page.locator("#stock-photo-label").isVisible());
check("「イラストから選ぶ」も最初から見える", await page.locator("#btn-stock-photo-icon").isVisible());
check("残量ボタンは見える", await page.locator(".stock-level-picker").isVisible());

// 追加ボタンはフッターに固定され、画面内に収まる
const addBtn = page.locator("#btn-add-stock");
check("追加ボタンはシートのフッターにある", (await page.locator("#stock-sheet .sheet-footer #btn-add-stock").count()) === 1);
const ab = await addBtn.boundingBox();
check("追加ボタンが画面内に収まる（667px の端末）", ab && ab.y >= 0 && ab.y + ab.height <= 667, ab ? `bottom=${Math.round(ab.y + ab.height)}` : "none");
const scroll = await page.evaluate(() => { const c = document.querySelector("#stock-sheet .sheet-content"); return { sh: c.scrollHeight, ch: c.clientHeight }; });
check("閉じた状態では中身がスクロール不要", scroll.sh <= scroll.ch + 1, `${scroll.sh}/${scroll.ch}`);

// --- 開く ---
await toggle.click();
await sleep(200);
check("押すと任意項目が開く", await page.locator("#stock-more-fields.open").isVisible());
check("aria-expanded=true", (await toggle.getAttribute("aria-expanded")) === "true");
check("ラベルが「閉じる」に変わる", (await page.locator("#stock-more-fields-label").innerText()).includes("閉じる"));
check("メモ・予算・買う間隔が見える", (await page.locator("#stock-memo").isVisible()) && (await page.locator("#stock-budget").isVisible()) && (await page.locator("#stock-cycle").isVisible()));
check("開いても追加ボタンは画面内（フッター固定）", await addBtn.isVisible());
check("開いたら要約は出さない", (await page.locator("#stock-more-fields-summary").innerText()) === "");

// --- 値を入れて閉じると「設定あり」の要約 ---
await page.fill("#stock-memo", "国産・無添加");
await page.fill("#stock-budget", "500");
await toggle.click();
await sleep(200);
check("閉じると任意項目が隠れる", !(await page.locator("#stock-more-fields").isVisible()));
const summary = await page.locator("#stock-more-fields-summary").innerText();
check("閉じたとき「設定あり: 予算・メモ」が出る", summary === "設定あり: 予算・メモ", summary);

// 閉じたままでも入れた値ごと保存される
await page.fill("#stock-name", "重曹");
await page.click('#stock-category .cat-chip[data-cat="daily"]');
await page.click("#btn-add-stock");
await sleep(700);
check("閉じたまま追加してもメモが保存される", (await page.locator(".stock-item", { hasText: "重曹" }).count()) === 1);
const saved = await page.evaluate(async () => {
  const snap = await firebase.database().ref("families/fam1/stocks").once("value");
  const all = snap.val() || {};
  const hit = Object.values(all).find((s) => s && s.name === "重曹");
  return hit || null;
});
check("メモがDBに保存される", saved && saved.memo === "国産・無添加", JSON.stringify(saved));
check("予算がDBに保存される", saved && saved.budget === 500, JSON.stringify(saved));

// --- 次に開いたときは閉じた状態から ---
await page.click("#btn-stock-register");
await sleep(500);
check("開き直すと閉じた状態に戻る", !(await page.locator("#stock-more-fields").isVisible()));
check("値はリセットされ要約も空", (await page.locator("#stock-more-fields-summary").innerText()) === "");
await page.click("#btn-stock-sheet-close");

if (errs.length) console.log(errs);
await t.finish();
