// 「行き先」機能の検証: 設定タブでの登録/削除、おつかい・よく買うもの・ストックへの
// 行き先指定、買い物リストでの行き先グルーピング表示、削除後の「行き先未設定」への復帰。
import { startHarness } from "../harness.mjs";
const t = await startHarness();
const { url, page, errs, sleep, OUT } = t;
const check = t.check;

await page.goto(url,{waitUntil:"domcontentloaded"});
await page.waitForSelector("#screen-main",{state:"visible",timeout:20000});
await sleep(900);

// --- 設定タブで行き先を登録 ---
await page.click('[data-tab="settings"]'); await sleep(500);
await page.click('[data-acc="destinations"] [data-acc-toggle]'); await sleep(400);
await page.fill("#new-destination-name", "スーパー");
await page.click("#btn-add-destination"); await sleep(400);
await page.fill("#new-destination-name", "薬局");
await page.click("#btn-add-destination"); await sleep(400);
check("設定タブに2件の行き先が並ぶ", (await page.locator("#destination-list .dest-chip").count())===2);
// 同名は重複登録できない
await page.fill("#new-destination-name", "スーパー");
await page.click("#btn-add-destination"); await sleep(400);
check("同名は重複登録できない", (await page.locator("#destination-list .dest-chip").count())===2);
await page.screenshot({path:`${OUT}/dest1-settings.png`});

// --- おつかい追加シートに行き先チップが出て、選んで保存できる ---
await page.click('[data-tab="requests"]'); await sleep(400);
await page.click("#btn-add-float"); await sleep(400);
check("追加シートに行き先チップが2件出る", (await page.locator("#new-destination .cat-chip").count())===2);
await page.fill("#new-name", "洗剤A");
await page.click('#new-category .cat-chip[data-cat="daily"]');
await page.click('#new-destination .cat-chip:has-text("薬局")');
await page.click("#btn-add-request"); await sleep(600);
await page.click("#btn-add-float"); await sleep(400);
await page.fill("#new-name", "洗剤B");
await page.click('#new-category .cat-chip[data-cat="daily"]');
await page.click('#new-destination .cat-chip:has-text("スーパー")');
await page.click("#btn-add-request"); await sleep(600);
await page.click("#btn-add-float"); await sleep(400);
await page.fill("#new-name", "洗剤C");
await page.click('#new-category .cat-chip[data-cat="daily"]'); // 行き先は選ばない
await page.click("#btn-add-request"); await sleep(600);

// --- 買い物リストが「急ぎ→カテゴリ→行き先」でグルーピングされる ---
const listHtml = await page.locator("#list-open").innerHTML();
const dailyIdx = listHtml.indexOf("🧻 日用品");
const superIdx = listHtml.indexOf("🏬 スーパー");
const yakkyokuIdx = listHtml.indexOf("🏬 薬局");
const noneIdx = listHtml.lastIndexOf("行き先未設定");
check("日用品セクションの中に行き先の小見出しが並ぶ", dailyIdx>=0 && dailyIdx<superIdx && superIdx<yakkyokuIdx && yakkyokuIdx<noneIdx, `${dailyIdx},${superIdx},${yakkyokuIdx},${noneIdx}`);
check("急ぎセクションは行き先で分けない", !listHtml.slice(0, listHtml.indexOf("🍎 食品")).includes("check-dest-hdr"));
await page.screenshot({path:`${OUT}/dest2-grouped-list.png`});

// --- 詳細を開くと行き先のヒントが見える ---
await page.locator(".check-row", { hasText: "洗剤A" }).first().locator(".check-main").click();
await sleep(400);
check("詳細に行き先のヒントが出る", (await page.locator(".check-detail").innerText()).includes("薬局"));
await page.screenshot({path:`${OUT}/dest3-detail-hint.png`});
await page.locator(".check-row", { hasText: "洗剤A" }).first().locator(".check-main").click(); await sleep(400); // 閉じる

// --- ストックに行き先を設定すると、買い物リストに追加したとき引き継がれる ---
await page.click('[data-tab="stock"]'); await sleep(400);
await page.click("#btn-stock-register"); await sleep(400);
await page.fill("#stock-name", "アイス");
await page.click('#stock-category .cat-chip[data-cat="food"]');
check("ストック登録シートにも行き先チップが出る", (await page.locator("#stock-destination .cat-chip").count())===2);
await page.click('#stock-destination .cat-chip:has-text("スーパー")');
await page.click("#btn-add-stock"); await sleep(600);
await page.locator(".stock-item", { hasText: "アイス" }).first().click(); await sleep(400);
await page.click("#btn-stock-detail-more"); await sleep(300); // 行き先は「⚙️ 詳細設定」の中
check("ストック詳細にも選択済みの行き先が反映される", await page.locator('#stock-detail-dest .cat-chip.selected').innerText().then(t=>t.includes("スーパー")));
await page.click("#btn-stock-detail-add"); await sleep(600);
await page.click('[data-tab="requests"]'); await sleep(500);
await page.locator(".check-row", { hasText: "アイス" }).first().locator(".check-main").click();
await sleep(400);
check("ストック由来のおつかいにも行き先が引き継がれる", (await page.locator(".check-detail").innerText()).includes("スーパー"));

// --- 行き先を削除しても、既存の項目やアプリ全体が壊れず「行き先未設定」に戻る ---
await page.click('[data-tab="settings"]'); await sleep(400);
await page.click('#destination-list .dest-chip:has-text("薬局") [data-del-dest]'); await sleep(500);
check("削除すると設定タブから消える", !(await page.locator("#destination-list").innerText()).includes("薬局"));
await page.click('[data-tab="requests"]'); await sleep(500);
check("行き先を削除した品は「行き先未設定」の扱いに戻る（クラッシュしない）", (await page.locator("#list-open").innerText()).includes("行き先未設定"));

if(errs.length)fail++;

await t.finish();
