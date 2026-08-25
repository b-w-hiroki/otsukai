// おつかいに写真を添付できることの検証（追加・表示・拡大・外す）
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep, OUT } = t;
const check = t.check;

// 1x1 の透明PNG。ファイル選択の中身は問わない（スタブが data URL を返す）
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const pick = (sel) => page.setInputFiles(sel, { name: "shampoo.png", mimeType: "image/png", buffer: PNG });

await t.ready();

// --- 追加シートに写真の入力がある ---
await page.click("#btn-add-float");
await sleep(700);
check("追加シートに写真の入力がある", (await page.locator("#req-photo-input").count()) === 1);
check("「写真を外す」は最初は隠れている", !(await page.locator("#btn-req-photo-clear").isVisible()));

// --- 写真を選ぶとプレビューが出る ---
await pick("#req-photo-input");
await sleep(500);
check("選ぶとプレビューが出る", (await page.locator("#req-photo-preview-wrap .photo-preview").count()) === 1);
check("「写真を外す」が出る", await page.locator("#btn-req-photo-clear").isVisible());
await t.shot("photo-1-sheet");

// --- 外すとプレビューが消える ---
await page.click("#btn-req-photo-clear");
await sleep(300);
check("外すとプレビューが消える", (await page.locator("#req-photo-preview-wrap .photo-preview").count()) === 0);
check("プレースホルダに戻る", (await page.locator(".photo-placeholder").count()) >= 1);

// --- 写真つきで追加する ---
await page.fill("#new-name", "詰め替えシャンプー");
await pick("#req-photo-input");
await sleep(400);
await page.click("#btn-add-request");
await sleep(1200);

const row = page.locator(".check-row").filter({ hasText: "詰め替えシャンプー" }).first();
check("追加された", (await row.count()) === 1);
check("Storage にアップロードされた",
  (await page.evaluate(() => (self.__uploadedPhotos || []).some((p) => p.includes("/requests/")))), "");
check("一覧の行にサムネイルが出る", (await row.locator(".photo-thumb img").count()) === 1);
const thumbBox = await row.locator(".photo-thumb").boundingBox();
check("サムネイルのタップ領域が44px以上", thumbBox.width >= 44 && thumbBox.height >= 44,
  `${Math.round(thumbBox.width)}x${Math.round(thumbBox.height)}`);
await t.shot("photo-2-row");

// --- 行のサムネイルをタップすると、詳細ではなく写真が開く ---
await row.locator(".photo-thumb").click();
await sleep(500);
check("行のサムネイルのタップで拡大が開く", await page.locator("#photo-viewer.open").isVisible());
check("そのとき詳細は開かない", (await page.locator(".check-detail").count()) === 0);
await page.click("#btn-photo-viewer-close");
await sleep(400);

// --- 行を開くと写真が出る ---
await row.locator(".check-main").click();
await sleep(600);
const detailImg = page.locator(".check-detail .req-photo");
check("詳細に写真が出る", (await detailImg.count()) === 1);
await t.shot("photo-3-detail");

// --- タップで拡大される ---
await detailImg.click();
await sleep(500);
check("タップで拡大表示が開く", await page.locator("#photo-viewer.open").isVisible());
const viewerSrc = await page.locator("#photo-viewer-img").getAttribute("src");
check("拡大表示に画像が入っている", !!viewerSrc && viewerSrc.startsWith("data:image"), (viewerSrc || "").slice(0, 24));
await t.shot("photo-4-viewer");
await page.click("#btn-photo-viewer-close");
await sleep(400);
check("閉じられる", !(await page.locator("#photo-viewer.open").count()));

// --- 編集で写真を外せる ---
await page.locator(".check-detail [data-edit-btn]").first().click();
await sleep(700);
check("編集シートに既存の写真が入る", (await page.locator("#req-photo-preview-wrap .photo-preview").count()) === 1);
await page.click("#btn-req-photo-clear");
await page.click("#btn-add-request");
await sleep(1000);
const row2 = page.locator(".check-row").filter({ hasText: "詰め替えシャンプー" }).first();
check("外すとサムネイルが消える", (await row2.locator(".photo-thumb").count()) === 0);

// --- 履歴にもサムネイルが出る ---
await page.click("#btn-add-float");
await sleep(600);
await page.fill("#new-name", "ホットケーキミックス");
await pick("#req-photo-input");
await sleep(400);
await page.click("#btn-add-request");
await sleep(1200);
const hRow = page.locator(".check-row").filter({ hasText: "ホットケーキミックス" }).first();
await hRow.locator(".check-circle").click();  // 買うよ
await sleep(700);
await hRow.locator(".check-done-btn").click(); // 買ったよ → 履歴へ
await sleep(1000);
await t.openHistory();
await sleep(900);
check("履歴のカードにもサムネイルが出る",
  (await page.locator("#history-list .req-row").filter({ hasText: "ホットケーキミックス" })
     .first().locator(".photo-thumb img").count()) === 1);
await t.shot("photo-6-history");
await page.click("#btn-history-close");
await sleep(500);

await t.finish();
