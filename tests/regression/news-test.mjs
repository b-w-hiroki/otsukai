// 📣 お知らせ（news.js / news.html）の検証:
// 設定タブのボタンと未読バッジ（先頭の id を localStorage で既読管理）、
// news.html が NEWS を日付の新しい順に描き、最新だけ開いていること。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { url, page, errs, sleep } = t;
const check = t.check;

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#screen-main", { state: "visible", timeout: 20000 });
await sleep(700);

// --- 設定タブ: ボタンと未読バッジ ---
await page.click('[data-tab="settings"]'); await sleep(500);
check("設定タブに📣お知らせボタンがある", (await page.locator("#btn-news").count()) === 1);
check("news.html へのリンクになっている", (await page.locator("#btn-news").getAttribute("href")) === "./news.html");
check("未読なので赤丸バッジが出る", await page.locator("#news-dot").isVisible());
const latestId = await page.evaluate(() => NEWS[0].id);
// target=_blank で別タブが開かないよう、テストでは既定動作だけ止めてクリック（既読処理は動く）
await page.evaluate(() => {
  const a = document.getElementById("btn-news");
  a.addEventListener("click", (e) => e.preventDefault(), { once: true });
  a.click();
});
await sleep(200);
check("押すと既読になりバッジが消える", !(await page.locator("#news-dot").isVisible()));
check("既読の id が端末に保存される", (await page.evaluate(() => localStorage.getItem("newsSeenId"))) === latestId, latestId);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("#screen-main", { state: "visible", timeout: 20000 });
await sleep(700);
await page.click('[data-tab="settings"]'); await sleep(400);
check("再読み込みしてもバッジは出ない（既読を覚えている）", !(await page.locator("#news-dot").isVisible()));

// --- news.html: 一覧の描画 ---
await page.goto(url + "news.html", { waitUntil: "domcontentloaded" });
await sleep(600);
const total = await page.evaluate(() => NEWS.length);
check("更新の件数ぶん <details> が並ぶ", (await page.locator("details.update").count()) === total, String(total));
check("最新の更新だけ開いている", (await page.locator("details.update[open]").count()) === 1
  && (await page.locator("details.update").first().getAttribute("open")) !== null);
const firstItems = await page.evaluate(() => NEWS.slice().sort((a, b) => b.date.localeCompare(a.date))[0].items.length);
check("最新の更新の変更点がすべて描かれる", (await page.locator("details.update").first().locator(".item").count()) === firstItems, String(firstItems));
const dateText = await page.locator("details.update").first().locator(".date").innerText();
check("日付が「YYYY年M月D日」で出る", /^\d{4}年\d{1,2}月\d{1,2}日$/.test(dateText), dateText);
check("各変更点に種類のタグと見出しが付く", (await page.locator("details.update").first().locator(".item .tag").count()) === firstItems
  && (await page.locator("details.update").first().locator(".item h3").count()) === firstItems);
// 画像は loading="lazy" で画面外は読み込まれないため、onload は待たずにパスの実在を fetch で確かめる
const brokenImgs = await page.evaluate(async () => {
  const srcs = [...document.querySelectorAll("details.update[open] img")].map((i) => i.getAttribute("src"));
  const results = await Promise.all(srcs.map((s) => fetch(s).then((r) => r.ok).catch(() => false)));
  return results.filter((ok) => !ok).length;
});
check("スクショの画像が全部読み込める（パス切れなし）", brokenImgs === 0, String(brokenImgs));
check("「アプリに戻る」ボタンがある", (await page.locator(".back-float").count()) === 1);

if (errs.length) fail++;

await t.finish();
