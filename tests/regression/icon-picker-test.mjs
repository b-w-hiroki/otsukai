// 「イラストから選ぶ」ピッカーの検証。写真アップロードの代わりに、用意した201種の
// イラストから明示的に選べる機能（おつかい/よく買うもの/ストックの写真欄で共通）。
// 選んだイラストは photoUrl にパスをそのまま入れる（Storageへのアップロードは発生しない）。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

// 1x1 の透明PNG。ファイル選択の中身は問わない（スタブが data URL を返す）
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const pickPhoto = (sel) => page.setInputFiles(sel, { name: "photo.png", mimeType: "image/png", buffer: PNG });

await t.ready();

// --- おつかい追加シート: 「🎨 イラストから選ぶ」でピッカーが開き、選ぶとプレビューに反映される ---
await page.click("#btn-add-float");
await sleep(500);
await page.fill("#new-name", "キャベツ大玉");
check("「イラストから選ぶ」ボタンがある", (await page.locator("#btn-req-photo-icon").count()) === 1);
await page.click("#btn-req-photo-icon");
await sleep(500);
check("ピッカーが開く", await page.locator("#icon-picker-sheet.open").isVisible());
check("「写真をセットする」ボタンは出ない（新規追加時は写真ラベルが既に主導線のため）",
  !(await page.locator("#btn-icon-picker-camera").isVisible()));
const libCount = await page.evaluate(() => ICON_LIBRARY.length);
const groupCount = await page.evaluate(() => Object.keys(ICON_GROUPS).length);
const tileCount = await page.locator('#icon-picker-grid .icon-picker-tile[data-file]').count();
check("ライブラリの全件がDOMにある（表示/非表示は別）", tileCount === libCount && libCount >= 100, `${tileCount}/${libCount}`);
check("分類の見出しが付く", (await page.locator('#icon-picker-grid .icon-picker-group-hdr').count()) >= 5);
check("日用品のイラストもある", (await page.locator('#icon-picker-grid .icon-picker-tile[data-file="toiletpaper"]').count()) === 1);

// --- 分類が多いので、1ページの縦スクロールではなくタブで切り替える ---
const tabs = page.locator("#icon-picker-tabs .icon-picker-tab");
check("分類の数ぶんタブが並ぶ", (await tabs.count()) === groupCount, String(await tabs.count()));
check("開いた直後は先頭のタブが選ばれている（🥬野菜）", (await tabs.first().innerText()) === "🥬 野菜" && (await tabs.first().evaluate((el) => el.classList.contains("selected"))));
check("検索していないときは、選ばれたタブの分類だけ見える", (await page.locator('#icon-picker-grid .icon-picker-tile:visible').count()) < libCount);
check("見出しは出さない（タブが分類を表すため二重にしない）", (await page.locator('#icon-picker-grid .icon-picker-group-hdr:visible').count()) === 0);
check("トマト（野菜）は見える", await page.locator('#icon-picker-grid .icon-picker-tile[data-file="tomato"]').isVisible());
check("トイレットペーパー（日用品）はまだ見えない", !(await page.locator('#icon-picker-grid .icon-picker-tile[data-file="toiletpaper"]').isVisible()));
// 「日用品」タブに切り替えると、その分類だけに変わる
await page.click('#icon-picker-tabs .icon-picker-tab:has-text("日用品")');
await sleep(200);
check("タブを切り替えるとトイレットペーパーが見える", await page.locator('#icon-picker-grid .icon-picker-tile[data-file="toiletpaper"]').isVisible());
check("切り替えるとトマトは隠れる", !(await page.locator('#icon-picker-grid .icon-picker-tile[data-file="tomato"]').isVisible()));
check("選択中のタブ表示が切り替わる", await page.locator('#icon-picker-tabs .icon-picker-tab.selected').innerText() === "🧻 日用品");
check("非選択のタブは selected でない", !(await tabs.first().evaluate((el) => el.classList.contains("selected"))));
// 以降の検証・キャベツのタップは「野菜」タブ前提のため、いったん戻しておく
await tabs.first().click();
await sleep(200);
check("野菜タブに戻すとトマトが再び見える", await page.locator('#icon-picker-grid .icon-picker-tile[data-file="tomato"]').isVisible());
// 品名からの自動判定は「いちばん長いキーワード」を優先する
const auto = await page.evaluate(() => [matchShortcutIcon("フライパン"), matchShortcutIcon("パンツ"), matchShortcutIcon("食器用洗剤"), matchShortcutIcon("食パン")]);
check("フライパン→キッチン用品（パンに化けない）", auto[0].endsWith("/kitchen.svg"), auto[0]);
check("パンツ→下着（パンに化けない）", auto[1].endsWith("/underwear.svg"), auto[1]);
// 検索欄で絞り込める（ラベルだけでなくキーワードでも当たる）
await page.fill("#icon-picker-search", "醤油");
await sleep(200);
const visibleAfterSearch = await page.locator('#icon-picker-grid .icon-picker-tile:visible').count();
check("検索で絞り込める（醤油→調味料タイルだけ）", visibleAfterSearch === 1 && (await page.locator('#icon-picker-grid .icon-picker-tile:visible').getAttribute("data-file")) === "seasoning", String(visibleAfterSearch));
check("該当が無い分類の見出しは隠れる", (await page.locator('#icon-picker-grid .icon-picker-group-hdr:visible').count()) === 1);
await page.fill("#icon-picker-search", "zzzz");
await sleep(200);
check("見つからないときは案内が出る", await page.locator("#icon-picker-empty").isVisible());
await page.fill("#icon-picker-search", "");
await sleep(200);
// 検索を空にすると、全件表示ではなく「検索前に選んでいたタブ（野菜）」だけに戻る
const veg = await page.evaluate(() => ICON_LIBRARY.filter((it) => it.group === "veg").length);
check("空にすると検索前のタブ（野菜）に戻る", (await page.locator('#icon-picker-grid .icon-picker-tile:visible').count()) === veg, String(veg));
check("食器用洗剤→食器用洗剤（洗濯洗剤に化けない）", auto[2].endsWith("/dishsoap.svg"), auto[2]);
check("食パン→パン", auto[3].endsWith("/bread.svg"), auto[3]);
await page.click('#icon-picker-grid .icon-picker-tile[data-file="cabbage"]');
await sleep(400);
check("ピッカーが閉じる", !(await page.locator("#icon-picker-sheet.open").count()));
const previewSrc = await page.locator("#req-photo-preview-wrap img").getAttribute("src").catch(() => null);
check("プレビューにイラストが反映される", previewSrc === "./shortcut-icons/cabbage.svg", previewSrc);
await page.click('#new-category .cat-chip[data-cat="food"]');
await page.click("#btn-add-request");
await sleep(700);
const savedReqPhoto = await page.evaluate(async () => {
  const snap = await firebase.database().ref("families/fam1/requests").once("value");
  const all = snap.val() || {};
  const hit = Object.values(all).find((r) => r && r.name === "キャベツ大玉");
  return hit ? hit.photoUrl : null;
});
check("DBにイラストのパスがそのまま保存される（アップロードなし）", savedReqPhoto === "./shortcut-icons/cabbage.svg", savedReqPhoto);

// --- ストック登録シート: 同じピッカーで選べる ---
await page.click('[data-tab="stock"]');
await sleep(500);
await page.click("#btn-stock-register");
await sleep(500);
await page.fill("#stock-name", "サラダ油");
await page.click('#stock-category .cat-chip[data-cat="food"]');
await page.click("#btn-stock-photo-icon");
await sleep(400);
await page.click('#icon-picker-grid .icon-picker-tile[data-file="onion"]');
await sleep(400);
const stockPreviewSrc = await page.locator("#stock-photo-preview-wrap img").getAttribute("src").catch(() => null);
check("ストック登録のプレビューにイラストが反映される", stockPreviewSrc === "./shortcut-icons/onion.svg", stockPreviewSrc);
await page.click("#btn-add-stock");
await sleep(700);
const savedStockPhoto = await page.evaluate(async () => {
  const snap = await firebase.database().ref("families/fam1/stocks").once("value");
  const all = snap.val() || {};
  const hit = Object.values(all).find((r) => r && r.name === "サラダ油");
  return hit ? hit.photoUrl : null;
});
check("ストックDBにもイラストのパスが保存される", savedStockPhoto === "./shortcut-icons/onion.svg", savedStockPhoto);

// --- ストック詳細シート: 登録済みの品にも「写真を変更」ボタンから同じピッカーが使える ---
const soy = page.locator(".stock-item").filter({ hasText: "しょうゆ" }).first();
await soy.click();
await sleep(500);
check("詳細シートに写真変更ボタンがある", (await page.locator("#btn-stock-detail-photo").count()) === 1);
await page.click("#btn-stock-detail-photo");
await sleep(400);
check("詳細シートからは「写真をセットする」ボタンがイラスト一覧とは別枠で出る（撮る/選ぶも両方できる）",
  await page.locator("#btn-icon-picker-camera").isVisible());
// パン（bread）は「乳製品・パン・主食」タブで、開いた直後は「野菜」タブのまま。
// タブを切り替える代わりに検索で出す（検索はタブに関係なく全分類から探せる）
await page.fill("#icon-picker-search", "食パン");
await sleep(200);
await page.click('#icon-picker-grid .icon-picker-tile[data-file="bread"]');
await sleep(700);
const soyPhoto = await page.evaluate(async () => {
  const snap = await firebase.database().ref("families/fam1/stocks").once("value");
  const all = snap.val() || {};
  const hit = Object.values(all).find((r) => r && r.name === "しょうゆ");
  return hit ? hit.photoUrl : null;
});
check("既存ストックの写真をイラストに変更できる", soyPhoto === "./shortcut-icons/bread.svg", soyPhoto);
await page.click("#btn-stock-detail-close");
await sleep(400);

// --- 「写真をセットする」ボタンからは実写真も選べる（アップロード経路） ---
await page.locator(".stock-item").filter({ hasText: "米" }).first().click();
await sleep(500);
await page.click("#btn-stock-detail-photo");
await sleep(400);
await page.click("#btn-icon-picker-camera");
await pickPhoto("#stock-detail-photo-input");
// 完了トースト（「変更しました」）が出るまで待つ（固定待ちはCIの遅いランナーで前段の
// 「アップロード中...」を掴んで落ちることがある）
await page.waitForFunction(() => (document.getElementById("toasts")?.innerText || "").includes("写真を変更しました"), null, { timeout: 8000 }).catch(() => {});
await sleep(200);
const toast = await page.locator("#toasts").innerText().catch(() => "");
check("「写真をセットする」からは実写真をアップロードできる", toast.includes("写真を変更しました"), toast);
await page.click("#btn-stock-detail-close");
await sleep(400);

await t.finish();
