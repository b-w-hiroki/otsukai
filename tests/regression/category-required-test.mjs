// カテゴリ選択の必須化を検証する。
// 意図せず「未分類」になってしまうのを防ぐため、追加/編集シート・よく買うもの登録シートの
// どちらも 🍎食品/🧻日用品/📦その他/📎未分類 のいずれかを明示的にタップしないと保存できない。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

const categoryOf = async (name) =>
  page.evaluate(async (n) => {
    const snap = await firebase.database().ref("families/fam1/requests").once("value");
    const hit = Object.values(snap.val() || {}).find((r) => r && r.name === n);
    return hit ? hit.category : undefined;
  }, name);

await t.ready();

// --- おつかい追加: カテゴリを選ばずに追加しようとするとブロックされる ---
await page.click("#btn-add-float");
await sleep(500);
await page.fill("#new-name", "洗濯ネット");
const beforeCount = await page.locator(".check-row").count();
await page.click("#btn-add-request");
await sleep(400);
const toast1 = await page.locator("#toasts").innerText().catch(() => "");
check("カテゴリ未選択だとトーストで案内される", toast1.includes("カテゴリを選んでください"), toast1);
check("追加されていない", (await page.locator(".check-row").count()) === beforeCount);
check("シートは開いたまま", await page.locator("#sheet-add.open").isVisible());

// --- 「📎 未分類」を明示的に選べば、意図した未分類として保存できる ---
await page.click('#new-category .cat-chip[data-cat="none"]');
await page.click("#btn-add-request");
await sleep(1000);
check("未分類を選ぶと追加できる", (await page.locator(".check-row").count()) === beforeCount + 1);
check("category が \"none\" として明示的に保存される", (await categoryOf("洗濯ネット")) === "none");

// --- 未分類のまま編集を開くと、チップがすでに選択されている（再選択を強制しない） ---
const row = page.locator(".check-row").filter({ hasText: "洗濯ネット" }).first();
await row.locator(".check-main").click();
await sleep(500);
await page.locator(".check-detail [data-edit-btn]").first().click();
await sleep(500);
check("編集シートで「📎未分類」が選択済みになっている",
  await page.locator('#new-category .cat-chip[data-cat="none"]').evaluate((el) => el.classList.contains("selected")));
await page.click("#btn-sheet-close");
await sleep(400);

// --- よく買うもの登録シートも同様にカテゴリが必須 ---
await page.click("#btn-shortcut-toggle");
await sleep(500);
await page.click("#btn-shortcut-register");
await sleep(500);
await page.fill("#new-name", "重曹");
await page.click("#btn-add-request");
await sleep(400);
const toast2 = await page.locator("#toasts").innerText().catch(() => "");
check("よく買うもの登録でもカテゴリ未選択はブロックされる", toast2.includes("カテゴリを選んでください"), toast2);
check("よく買うものにはまだ登録されていない",
  (await page.evaluate(async () => {
    const snap = await firebase.database().ref("families/fam1/shortcuts").once("value");
    return Object.values(snap.val() || {}).some((s) => s && s.name === "重曹");
  })) === false);
await page.click('#new-category .cat-chip[data-cat="daily"]');
await page.click("#btn-add-request");
await sleep(1000);
check("カテゴリを選べば登録できる",
  (await page.evaluate(async () => {
    const snap = await firebase.database().ref("families/fam1/shortcuts").once("value");
    return Object.values(snap.val() || {}).some((s) => s && s.name === "重曹");
  })));

await t.finish();
