// ストックの商品名を後から編集できる／自分以外が追加したおつかいにメモを追記できる／
// ストックにもカテゴリを付けられ、買い物リストに追加したときに引き継がれる、の検証
import { startHarness } from "../harness.mjs";
const t = await startHarness({ dialogAnswer: "改名テスト" });
const { url, page, errs, sleep, OUT } = t;
const check = t.check;

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(900);

// --- ストックの商品名を編集 ---
await page.click('[data-tab="stock"]'); await sleep(600);
await page.locator(".stock-item", { hasText: "ラップ" }).first().click();
await sleep(500);
check("ストック詳細に✏️名前ボタンがある", await page.locator("#btn-stock-detail-rename").count()===1);
await page.click("#btn-stock-detail-rename");
await sleep(600);
check("プロンプトのタイトル", t.lastDialog().includes("商品名"));
check("詳細タイトルが新しい名前に変わる", (await page.locator("#stock-detail-title").textContent())==="改名テスト");
await page.click("#btn-stock-detail-close");
await sleep(400);
check("ストック一覧にも新しい名前が反映される", (await page.locator("#tab-stock").innerText()).includes("改名テスト"));
await page.screenshot({path:`${OUT}/se1-renamed.png`});

// --- 自分以外が追加した「牛乳」にメモを追記 ---
await page.click('[data-tab="requests"]'); await sleep(500);
const milk = page.locator(".check-row", { hasText: "牛乳" }).first();
await milk.locator(".check-main").click();
await sleep(500);
check("自分以外の行には✏️編集ではなく📝メモボタンが出る", await page.locator(".check-detail [data-memo-btn]").count()===1);
check("✏️編集ボタンは出ない（追加者本人のみ）", await page.locator(".check-detail [data-edit-btn]").count()===0);
await page.locator(".check-detail [data-memo-btn]").click();
await sleep(600);
check("メモ追記後、行にメモのヒントが表示される", (await page.locator(".check-detail").innerText()).includes("改名テスト"));
await page.screenshot({path:`${OUT}/se2-memo.png`});
await milk.locator(".check-main").click(); await sleep(400); // 詳細を閉じておく（次の検証で複数開いた状態にしないため）

// --- ストックの新規登録はカテゴリが必須。選ぶと買い物リストにも引き継がれる ---
await page.click('[data-tab="stock"]'); await sleep(500);
await page.click("#btn-stock-register"); await sleep(400);
await page.fill("#stock-name", "洗濯洗剤");
await page.click("#btn-add-stock"); await sleep(400);
check("カテゴリ未選択では登録できない（シートが開いたまま）", await page.locator("#stock-sheet.open").count()===1);
await page.click('#stock-category .cat-chip[data-cat="daily"]');
await page.click("#btn-add-stock"); await sleep(500);
check("カテゴリを選ぶと登録できる", (await page.locator("#stock-low-section, #stock-ok-section, #stock-out-section").allInnerTexts()).join("").includes("洗濯洗剤"));
await page.locator(".stock-item", { hasText: "洗濯洗剤" }).first().click(); await sleep(400);
await page.click('#btn-stock-detail-add'); await sleep(500);
await page.click('[data-tab="requests"]'); await sleep(500);
await page.locator(".check-row", { hasText: "洗濯洗剤" }).first().locator(".check-main").click(); await sleep(400);
check("ストックのカテゴリが買い物リストにも引き継がれる（未分類にならない）", (await page.locator(".check-detail").innerText()).includes("日用品"));
await page.screenshot({path:`${OUT}/se3-category.png`});

if(errs.length)fail++;

await t.finish();
