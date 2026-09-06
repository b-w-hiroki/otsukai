// おつかい追加シートの「任意項目の折りたたみ」の検証:
// 開いた直後は品名・カテゴリ・写真・手間/急ぎ・「＋ くわしく設定」・追加ボタンが見え、
// 任意項目（行き先・予算・ブランド・メモ・担当）は押すまで隠れている
// （写真・イラストはカテゴリと同じく基本の位置に出すよう変更した）。
// 追加ボタンはシート下部に固定され、小さい画面でもスクロールせずに押せる。
// 編集で任意項目に値が入っていれば自動で開き、閉じたときは「設定あり: …」の要約が出る。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep, errs } = t;
const check = t.check;

// 小さい端末（iPhone SE 相当）で「ファーストビューに収まる」ことを見る
await page.setViewportSize({ width: 375, height: 667 });
await t.ready();

await page.click("#btn-add-float");
await sleep(500);
check("追加シートが開く", await page.locator("#sheet-add.open").isVisible());

// --- 閉じた状態: 必須項目と主操作だけ ---
const toggle = page.locator("#btn-more-fields");
check("「くわしく設定」ボタンがある", await toggle.isVisible());
const tb = await toggle.boundingBox();
check("ボタンのタップ領域は44px以上", tb && tb.height >= 44, tb ? `${tb.width}x${tb.height}` : "none");
check("最初は閉じている（aria-expanded=false）", (await toggle.getAttribute("aria-expanded")) === "false");
check("任意項目は隠れている", !(await page.locator("#more-fields").isVisible()));
for (const id of ["new-budget", "new-brand", "new-memo", "new-assignee"]) {
  check(`#${id} は見えない`, !(await page.locator("#" + id).isVisible()));
}
check("品名は見える", await page.locator("#new-name").isVisible());
check("カテゴリは見える", await page.locator("#new-category").isVisible());
check("写真はカテゴリと同じく最初から見える", await page.locator("#req-photo-label").isVisible());
check("「イラストから選ぶ」も最初から見える", await page.locator("#btn-req-photo-icon").isVisible());
check("手間・急ぎは見える", (await page.locator("#new-diff").isVisible()) && (await page.locator("#new-urgent").isVisible()));

// 追加ボタンはフッターに固定され、画面内に収まる
const addBtn = page.locator("#btn-add-request");
check("追加ボタンはシートのフッターにある", (await page.locator("#sheet-add .sheet-footer #btn-add-request").count()) === 1);
const ab = await addBtn.boundingBox();
check("追加ボタンが画面内に収まる（667px の端末）", ab && ab.y >= 0 && ab.y + ab.height <= 667, ab ? `bottom=${Math.round(ab.y + ab.height)}` : "none");
const scroll = await page.evaluate(() => { const c = document.querySelector("#sheet-add .sheet-content"); return { sh: c.scrollHeight, ch: c.clientHeight }; });
check("閉じた状態では中身がスクロール不要", scroll.sh <= scroll.ch + 1, `${scroll.sh}/${scroll.ch}`);

// --- 開く ---
await toggle.click();
await sleep(200);
check("押すと任意項目が開く", await page.locator("#more-fields.open").isVisible());
check("aria-expanded=true", (await toggle.getAttribute("aria-expanded")) === "true");
check("ラベルが「閉じる」に変わる", (await page.locator("#more-fields-label").innerText()).includes("閉じる"));
check("メモ・担当が見える", (await page.locator("#new-memo").isVisible()) && (await page.locator("#new-assignee").isVisible()));
check("開いても追加ボタンは画面内（フッター固定）", await addBtn.isVisible());
check("開いたら要約は出さない", (await page.locator("#more-fields-summary").innerText()) === "");

// --- 値を入れて閉じると「設定あり」の要約 ---
await page.fill("#new-memo", "小さいサイズで");
await page.fill("#new-budget", "300");
await toggle.click();
await sleep(200);
check("閉じると任意項目が隠れる", !(await page.locator("#more-fields").isVisible()));
const summary = await page.locator("#more-fields-summary").innerText();
check("閉じたとき「設定あり: 予算・メモ」が出る", summary === "設定あり: 予算・メモ", summary);

// 閉じたままでも入れた値ごと保存される
await page.fill("#new-name", "低脂肪牛乳テスト");
await page.click('#new-category .cat-chip[data-cat="food"]');
await page.click("#btn-add-request");
await sleep(700);
check("閉じたまま追加してもメモが保存される", (await page.locator(".check-row", { hasText: "低脂肪牛乳テスト" }).count()) === 1);

// --- 次に開いたときは閉じた状態から ---
await page.click("#btn-add-float");
await sleep(500);
check("開き直すと閉じた状態に戻る", !(await page.locator("#more-fields").isVisible()));
check("値はリセットされ要約も空", (await page.locator("#more-fields-summary").innerText()) === "");
await page.click("#btn-sheet-close");
await sleep(400);

// --- 編集: 任意項目に値がある依頼は自動で開く ---
// 詳細（.check-detail）は行（.check-row）の直後の兄弟要素
await page.locator(".check-row", { hasText: "低脂肪牛乳テスト" }).locator(".check-main").click();
await sleep(400);
await page.locator('.check-row:has-text("低脂肪牛乳テスト") + .check-detail [data-edit-btn]').click();
await sleep(500);
check("編集シートが開く", await page.locator("#sheet-add.open").isVisible());
check("メモがある依頼の編集では任意項目が最初から開く", await page.locator("#more-fields.open").isVisible());
check("既存のメモが入っている", (await page.inputValue("#new-memo")) === "小さいサイズで");
await page.click("#btn-sheet-close");
await sleep(300);

// --- 編集: 任意項目が空の依頼は閉じたまま ---
await page.click("#btn-add-float");
await sleep(400);
await page.fill("#new-name", "食パン2");
await page.click('#new-category .cat-chip[data-cat="food"]');
await page.click("#btn-add-request");
await sleep(700);
await page.locator(".check-row", { hasText: "食パン2" }).locator(".check-main").click();
await sleep(400);
await page.locator('.check-row:has-text("食パン2") + .check-detail [data-edit-btn]').click();
await sleep(500);
check("任意項目が空の依頼の編集では閉じたまま", !(await page.locator("#more-fields").isVisible()));
await page.click("#btn-sheet-close");

if (errs.length) console.log(errs);
await t.finish();
