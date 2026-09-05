// 「よく買うもの」は下部タブを廃止し、買い物ページのフローティングボタン
// （⚡よく買う）から開くシート（#shortcut-sheet）に一本化した。登録・編集
// （削除・写真差し替え）・カード形式で写真を付けられることを、このシート
// を通して検証する。
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
const openSheet = async () => { await page.click("#btn-shortcut-toggle"); await sleep(500); };

await t.ready();

// --- 買い物ページにフローティングボタンがあり、44px以上のタップ領域を確保している ---
const floatBtn = page.locator("#btn-shortcut-toggle");
check("買い物ページに「⚡よく買う」ボタンがある", (await floatBtn.count()) === 1);
const floatBtnBox = await floatBtn.boundingBox();
check("タップ領域が44px以上", floatBtnBox.height >= 44, `高さ=${Math.round(floatBtnBox.height)}`);

// --- タップでシートが開く ---
await openSheet();
check("シートが開く", await page.locator("#shortcut-sheet.open").isVisible());

// --- 既定はリスト形式。カード形式に切り替えて以降の見た目を検証する ---
check("既定はリスト形式", (await page.locator("#shortcut-sheet .shortcut-row").count()) > 0);
await page.click('#shortcut-sheet .shortcut-viewmode-btn[data-viewmode="card"]');
await sleep(400);

// --- カード形式（グリッド）で、色がアンバー系統になっている（紫の主操作色とは別系統） ---
check("カード形式のグリッドで表示される", (await page.locator(".shortcut-card-grid").count()) > 0);
const cardColor = await page.locator(".shortcut-card").first().evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, border: s.borderColor };
});
check("カードの背景色が紫(--pri-soft)ではない", cardColor.bg !== "rgb(238, 236, 251)", JSON.stringify(cardColor));

// hover時にグローバルの紫ボタン色に負けないか（過去に実際に踏んだCSS詳細度バグの再発防止）
const hoverColor = await page.locator(".shortcut-card").last().evaluate(async (el) => {
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 150));
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, bgImage: s.backgroundImage };
});
check("hover時も紫グラデに化けない", hoverColor.bgImage === "none", JSON.stringify(hoverColor));

// --- 写真が無いカードでも、日用品を含めよくある品名なら連想イラストが出る
//     （ライブラリ拡充後は初期データの4品すべてに絵が付く。一致しない品名の
//      プレースホルダーは後段の「謎の食材X」で確認する） ---
const tpIcon = await page.locator(".shortcut-card").filter({ hasText: "トイレットペーパー" }).first()
  .locator(".shortcut-card-icon").getAttribute("src").catch(() => null);
check("日用品（トイレットペーパー）にも連想イラストが出る", tpIcon === "./shortcut-icons/toiletpaper.svg", tpIcon);

// --- 品名がよくある品と一致すると、写真の代わりに用意したイラストが出る ---
await page.evaluate(async () => {
  const db = firebase.database();
  await db.ref("families/fam1/shortcuts").push().set({ name: "アボカド", diff: "normal", createdAt: Date.now(), createdBy: "uid-parent" });
  await db.ref("families/fam1/shortcuts").push().set({ name: "国産鶏肉むね", diff: "normal", createdAt: Date.now(), createdBy: "uid-parent" });
  await db.ref("families/fam1/shortcuts").push().set({ name: "鶏もも肉", diff: "normal", createdAt: Date.now(), createdBy: "uid-parent" });
  await db.ref("families/fam1/shortcuts").push().set({ name: "シャケの切り身", diff: "normal", createdAt: Date.now(), createdBy: "uid-parent" });
  await db.ref("families/fam1/shortcuts").push().set({ name: "ブロッコリー", diff: "normal", createdAt: Date.now(), createdBy: "uid-parent" });
  await db.ref("families/fam1/shortcuts").push().set({ name: "謎の食材X", diff: "normal", createdAt: Date.now(), createdBy: "uid-parent" });
});
await sleep(700);
const avocadoCard = page.locator(".shortcut-card").filter({ hasText: "アボカド" }).first();
const avocadoIcon = await avocadoCard.locator(".shortcut-card-icon").getAttribute("src").catch(() => null);
check("アボカドは対応するイラストが出る", avocadoIcon === "./shortcut-icons/avocado.svg", avocadoIcon);
const chickenCard = page.locator(".shortcut-card").filter({ hasText: "国産鶏肉むね" }).first();
const chickenIcon = await chickenCard.locator(".shortcut-card-icon").getAttribute("src").catch(() => null);
check("キーワードが名前の一部でも一致する（国産鶏肉むね→鶏肉）", chickenIcon === "./shortcut-icons/chicken.svg", chickenIcon);
const chickenThighCard = page.locator(".shortcut-card").filter({ hasText: "鶏もも肉" }).first();
const chickenThighIcon = await chickenThighCard.locator(".shortcut-card-icon").getAttribute("src").catch(() => null);
check("部位名（鶏もも肉）でも一致する", chickenThighIcon === "./shortcut-icons/chicken.svg", chickenThighIcon);
const salmonCard = page.locator(".shortcut-card").filter({ hasText: "シャケの切り身" }).first();
const salmonIcon = await salmonCard.locator(".shortcut-card-icon").getAttribute("src").catch(() => null);
check("シャケは鮭のイラストが出る", salmonIcon === "./shortcut-icons/salmon.svg", salmonIcon);
const broccoliCard = page.locator(".shortcut-card").filter({ hasText: "ブロッコリー" }).first();
const broccoliIcon = await broccoliCard.locator(".shortcut-card-icon").getAttribute("src").catch(() => null);
check("ブロッコリーは対応するイラストが出る", broccoliIcon === "./shortcut-icons/broccoli.svg", broccoliIcon);
const unknownCard = page.locator(".shortcut-card").filter({ hasText: "謎の食材X" }).first();
check("一致しない品名は通常のプレースホルダーのまま", (await unknownCard.locator(".shortcut-card-icon").count()) === 0);
check("一致しない品名にはイラストではなくプレースホルダーが出る", (await unknownCard.locator(".shortcut-card-placeholder").count()) === 1);
// 実際に写真を登録すれば、連想イラストより本物の写真が優先される
await page.evaluate(async () => {
  const snap = await firebase.database().ref("families/fam1/shortcuts").once("value");
  const all = snap.val() || {};
  const hit = Object.entries(all).find(([, s]) => s && s.name === "アボカド");
  if (hit) await firebase.database().ref("families/fam1/shortcuts/" + hit[0] + "/photoUrl").set("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
});
await sleep(700);
check("本物の写真を登録すると連想イラストより優先される", (await avocadoCard.locator(".shortcut-card-icon").count()) === 0);

// --- シート内の「＋ 新しく登録する」から写真付きで登録できる ---
await page.click("#btn-shortcut-register");
await sleep(700);
check("登録シートが開く", await page.locator("#sheet-add.open").isVisible());
check("タイトルがよく買うもの登録になっている", (await page.locator("#sheet-add .sheet-title").innerText()).includes("よく買うもの"));
await page.fill("#new-name", "写真つきテスト品");
await pickPhoto("#req-photo-input");
await sleep(400);
await page.click('#new-category .cat-chip[data-cat="food"]');
await page.click("#btn-add-request");
await sleep(1500);
// 登録すると sheet-add は閉じる（shortcut-sheet はその前に自動で閉じている）ので、開き直して確認する
await openSheet();
const newCard = page.locator(".shortcut-card").filter({ hasText: "写真つきテスト品" }).first();
await newCard.locator(".shortcut-card-photo img").waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
check("登録した写真がカードに表示される", (await newCard.locator(".shortcut-card-photo img").count()) === 1);
const uploadedPaths = await page.evaluate(() => self.__uploadedPhotos || []);
check("Storageのアップロード先が families/.../shortcuts/ 配下になっている",
  uploadedPaths.some((p) => p.includes("/shortcuts/")), JSON.stringify(uploadedPaths));

// --- 品数が多いときもシート内でスクロールでき、末尾の項目まで操作できる ---
await page.evaluate(async () => {
  const db = firebase.database();
  const writes = [];
  for (let i = 0; i < 25; i++) {
    writes.push(db.ref("families/fam1/shortcuts").push().set({
      name: `大量テスト品${String(i).padStart(2, "0")}`, diff: "normal",
      createdAt: Date.now(), createdBy: "uid-parent",
    }));
  }
  await Promise.all(writes);
});
await sleep(700);
const lastCard = page.locator(".shortcut-card").filter({ hasText: "大量テスト品24" }).first();
await lastCard.scrollIntoViewIfNeeded();
await sleep(400);
check("一番下の項目までスクロールして表示できる", await lastCard.isVisible());
const beforeCount = await page.locator(".check-row").count();
await lastCard.click();
await sleep(800);
await page.click("#btn-shortcut-sheet-close");
await sleep(400);
check("末尾の項目も実際にタップして買い物リストに追加できる",
  (await page.locator(".check-row").filter({ hasText: "大量テスト品24" }).count()) === 1, `直前リスト件数=${beforeCount}`);

// --- ✏️編集ボタンで削除×と写真の差し替え目印が出る ---
await openSheet();
await page.click("#btn-shortcut-edit");
await sleep(400);
check("編集モードで削除×が出る", (await page.locator(".shortcut-card-del").count()) > 0);
check("編集モードで写真の差し替え目印が出る", (await page.locator(".shortcut-card-photo-hint").count()) > 0);

// --- 編集モードで写真をタップすると「イラストから選ぶ」ピッカーが開き、
//     「写真をセットする」から写真を撮る・選ぶこともできる（イラスト一覧とは別枠） ---
const targetCard = page.locator(".shortcut-card").filter({ hasText: "牛乳" }).first();
await targetCard.locator(".shortcut-card-photo").click();
await sleep(400);
check("ピッカーが開く", await page.locator("#icon-picker-sheet.open").isVisible());
check("「写真をセットする」ボタンがある", await page.locator("#btn-icon-picker-camera").isVisible());
await page.click("#btn-icon-picker-camera");
await pickPhoto("#shortcut-photo-replace-input");
// 「アップロード中...」→「変更しました」の2段階でトーストが出る。固定待ちだとCIの遅い
// ランナーで前段のトーストを掴んでしまうため、完了トーストが出るまで待つ
await page.waitForFunction(() => (document.getElementById("toasts")?.innerText || "").includes("写真を変更しました"), null, { timeout: 8000 }).catch(() => {});
await sleep(200);
check("差し替え後もカードに写真が表示される（プレースホルダーに戻らない）",
  (await targetCard.locator(".shortcut-card-photo img").count()) === 1);
const toast = await page.locator("#toasts").innerText().catch(() => "");
check("差し替えの完了トーストが出る", toast.includes("写真を変更しました"), toast);

// --- イラストから選んでも差し替わる ---
const targetCard2 = page.locator(".shortcut-card").filter({ hasText: "トイレットペーパー" }).first();
await targetCard2.locator(".shortcut-card-photo").click();
await sleep(400);
await page.click('#icon-picker-grid .icon-picker-tile[data-file="bread"]');
await sleep(700);
const icon2 = await targetCard2.locator(".shortcut-card-photo img").getAttribute("src").catch(() => null);
check("イラストから選んでも差し替わる", icon2 === "./shortcut-icons/bread.svg", icon2);

await page.click("#btn-shortcut-edit");
await sleep(300);
check("編集モード解除で削除×が消える", (await page.locator(".shortcut-card-del").count()) === 0);
check("編集モード解除で差し替え目印も消える", (await page.locator(".shortcut-card-photo-hint").count()) === 0);

// --- 登録が無いときの案内文が「＋」を指している ---
await page.evaluate(async () => {
  const snap = await firebase.database().ref("families/fam1/shortcuts").once("value");
  const all = snap.val() || {};
  await Promise.all(Object.keys(all).map((id) => firebase.database().ref("families/fam1/shortcuts/" + id).remove()));
});
await sleep(700);
const emptyText = await page.locator(".shortcut-chips-empty").innerText();
check("登録が無いときは「＋」での登録を案内する", emptyText.includes("＋"), emptyText);

await t.finish();
