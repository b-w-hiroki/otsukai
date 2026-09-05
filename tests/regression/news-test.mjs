// 📣 お知らせ（news.js / news.html / news-item.html）の検証:
// 右上のボタンと未読バッジ（先頭の id を localStorage で既読管理）、
// news.html が一覧を新しい順に描き、行から news-item.html の記事に飛べること。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { url, page, errs, sleep } = t;
const check = t.check;

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#screen-main", { state: "visible", timeout: 20000 });
await sleep(700);

// --- 右上: 🏆 📣 ？ の並びと未読バッジ ---
const btn = page.locator("#btn-news");
check("右上に📣お知らせボタンがある（トップバー内）", (await page.locator(".topbar #btn-news").count()) === 1);
check("設定メニューには置かない", (await page.locator("#tab-settings #btn-news").count()) === 0);
check("news.html へのリンクになっている", (await btn.getAttribute("href")) === "./news.html");
const box = await btn.boundingBox();
check("タップ領域44px以上", box && box.width >= 44 && box.height >= 44, box ? `${box.width}x${box.height}` : "none");
const order = await page.evaluate(() => [...document.querySelectorAll(".topbar-inner > *")].map((e) => e.id).filter(Boolean));
check("並びは 🏆ミッション → 📣お知らせ → ？使い方", order.indexOf("btn-missions-nav") < order.indexOf("btn-news") && order.indexOf("btn-news") < order.indexOf("btn-howto"), order.join(","));
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
check("再読み込みしてもバッジは出ない（既読を覚えている）", !(await page.locator("#news-dot").isVisible()));

// --- news.html: 一覧 ---
await page.goto(url + "news.html", { waitUntil: "domcontentloaded" });
await sleep(600);
const total = await page.evaluate(() => NEWS.length);
check("更新の件数ぶん行が並ぶ", (await page.locator("a.entry").count()) === total, String(total));
const first = page.locator("a.entry").first();
const dateText = await first.locator(".date").innerText();
check("日付が「YYYY年M月D日」で出る", /^\d{4}年\d{1,2}月\d{1,2}日$/.test(dateText), dateText);
const newest = await page.evaluate(() => NEWS.slice().sort((a, b) => b.date.localeCompare(a.date))[0]);
check("先頭が最新の更新", (await first.locator(".entry-title").innerText()) === newest.title);
check("行は記事ページ（news-item.html?id=）へのリンク", (await first.getAttribute("href")) === `./news-item.html?id=${encodeURIComponent(newest.id)}`);
check("一覧には本文を出さない（一覧と記事を分ける）", (await page.locator(".item").count()) === 0);

// --- news-item.html: 記事 ---
await first.click();
await page.waitForURL(/news-item\.html\?id=/);
await sleep(600);
check("記事の見出しが更新のタイトル", (await page.locator("#head h1").innerText()) === newest.title);
check("変更点がすべて描かれる", (await page.locator("#items .item").count()) === newest.items.length, String(newest.items.length));
check("各変更点に種類のタグと見出しが付く", (await page.locator("#items .item .tag").count()) === newest.items.length
  && (await page.locator("#items .item h2").count()) === newest.items.length);
// 「きっかけになった声」は voice がある変更点だけに出る
const voiceCount = newest.items.filter((i) => i.voice).length;
check("引用は voice がある変更点の数だけ出る", (await page.locator(".voice").count()) === voiceCount, String(voiceCount));
if (voiceCount) check("引用のラベルは「きっかけになった声」", (await page.locator(".voice-label").first().innerText()) === "きっかけになった声");
// 画像は loading="lazy" で画面外は読み込まれないため、onload は待たずにパスの実在を fetch で確かめる
const brokenImgs = await page.evaluate(async () => {
  const srcs = [...document.querySelectorAll("#items img")].map((i) => i.getAttribute("src"));
  const results = await Promise.all(srcs.map((s) => fetch(s).then((r) => r.ok).catch(() => false)));
  return results.filter((ok) => !ok).length;
});
check("スクショの画像が全部読み込める（パス切れなし）", brokenImgs === 0, String(brokenImgs));
check("一覧へ戻るリンクがある", (await page.locator('a.crumb[href="./news.html"]').count()) === 1);
const pagerLinks = await page.locator("#pager a").count();
check("前後の更新リンクは存在する分だけ出る", pagerLinks === Math.min(total - 1, 2), String(pagerLinks));

// --- 存在しない id は最新にフォールバック ---
await page.goto(url + "news-item.html?id=no-such-id", { waitUntil: "domcontentloaded" });
await sleep(500);
check("存在しない id でも最新の更新を表示する", (await page.locator("#head h1").innerText()) === newest.title);

if (errs.length) fail++;

await t.finish();
