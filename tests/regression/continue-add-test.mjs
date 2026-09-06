// 🔁「続けて追加する」トグルの検証:
// おつかい追加シートの下部にだけ出る（編集・よく買うもの登録には出さない）。
// ONで追加すると、シートを閉じずに品名欄へ戻り、カテゴリ/行き先は残るが
// 写真・手間・急ぎ・予算・ブランド・メモ・担当者はクリアされる。
// OFFなら従来どおり追加後にシートが閉じる。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep, errs } = t;
const check = t.check;
await t.ready();

// --- 設定タブで行き先を1件登録しておく（行き先チップが出る状態を作る） ---
await page.click('[data-tab="settings"]'); await sleep(400);
await page.click('[data-acc="destinations"] [data-acc-toggle]'); await sleep(300);
await page.fill("#new-destination-name", "スーパー");
await page.click("#btn-add-destination"); await sleep(400);
await page.click('[data-tab="requests"]'); await sleep(400);

// --- 「おつかいを追加」モードでは出る ---
await page.click("#btn-add-float");
await sleep(500);
check("追加モードでは「続けて追加する」が出る", await page.locator("#new-continue-wrap").isVisible());
check("開いた直後はチェックが外れている", !(await page.isChecked("#new-continue-add")));

// --- よく買うもの登録モードでは出ない ---
await page.click("#btn-sheet-close"); await sleep(400);
await page.click("#btn-shortcut-toggle"); await sleep(500);
await page.click("#btn-shortcut-register"); await sleep(700);
check("よく買うもの登録では出ない", !(await page.locator("#new-continue-wrap").isVisible()));
await page.click("#btn-sheet-close"); await sleep(400);

// --- ON にして1品目を追加。閉じずに、行き先・カテゴリは残ったまま品名等がクリアされる ---
await page.click("#btn-add-float"); await sleep(500);
await page.click("#btn-more-fields"); await sleep(300); // 行き先・写真・メモは任意項目の中
await page.fill("#new-name", "洗剤A");
await page.click('#new-category .cat-chip[data-cat="daily"]');
await page.click('#new-destination .cat-chip:has-text("スーパー")');
await page.fill("#new-memo", "詰め替え用");
await page.click("#new-continue-add");
await page.click("#btn-add-request");
await sleep(700);
check("ONのまま追加してもシートは開いたまま", await page.locator("#sheet-add.open").isVisible());
check("品名欄はクリアされる", (await page.inputValue("#new-name")) === "");
check("メモはクリアされる", (await page.inputValue("#new-memo")) === "");
check("カテゴリは選んだまま残る", await page.locator('#new-category .cat-chip[data-cat="daily"].selected').isVisible());
check("行き先は選んだまま残る", await page.locator('#new-destination .cat-chip:has-text("スーパー")').evaluate((el) => el.classList.contains("selected")));
check("トグル自体は ON のまま", await page.isChecked("#new-continue-add"));
check("1品目が追加されている", (await page.locator(".check-row", { hasText: "洗剤A" }).count()) === 1);

// --- 続けて2品目を入力して追加（カテゴリ・行き先はそのまま使う） ---
await page.fill("#new-name", "洗剤B");
await page.click("#btn-add-request");
await sleep(700);
check("2品目もシートを閉じずに追加できる", await page.locator("#sheet-add.open").isVisible());
check("2品目が同じカテゴリ・行き先で追加されている", (await page.locator(".check-row", { hasText: "洗剤B" }).count()) === 1);

// --- OFF にして3品目を追加すると、いつも通り閉じる ---
await page.fill("#new-name", "洗剤C");
await page.click("#new-continue-add");
await page.click("#btn-add-request");
await sleep(700);
check("OFFで追加するといつも通りシートが閉じる", !(await page.locator("#sheet-add.open").isVisible()));
check("3品目も追加されている", (await page.locator(".check-row", { hasText: "洗剤C" }).count()) === 1);

// --- 開き直すとチェックは外れている（毎回リセット） ---
await page.click("#btn-add-float"); await sleep(500);
check("開き直すとチェックはリセットされる", !(await page.isChecked("#new-continue-add")));
await page.click("#btn-sheet-close");

if (errs.length) console.log(errs);
await t.finish();
