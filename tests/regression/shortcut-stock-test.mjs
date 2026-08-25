// よく買うもの → ストック連動の検証（自動作成・買う間隔の反映・重複防止・二重管理防止）
// よく買うものは下部ナビの独立タブ（旧: シート）。登録は他のタブと同じくFABから開く。
import { startHarness } from "../harness.mjs";
const t = await startHarness();
const { page, sleep } = t;
const check = t.check;

const stockNamed = async (name) =>
  page.evaluate(async (n) => {
    const snap = await firebase.database().ref("families/fam1/stocks").once("value");
    const all = snap.val() || {};
    const hit = Object.entries(all).find(([, s]) => s && s.name === n);
    return hit ? hit[1] : null;
  }, name);
const stockCountNamed = async (name) =>
  page.evaluate(async (n) => {
    const snap = await firebase.database().ref("families/fam1/stocks").once("value");
    return Object.values(snap.val() || {}).filter((s) => s && s.name === n).length;
  }, name);
const openShortcutRegister = async () => {
  await page.click('[data-tab="shortcuts"]');
  await sleep(400);
  await page.click("#fab-add");
  await sleep(700);
};

await t.ready();

// --- 既存のショートカット（牛乳）は自動でストックが作られたりしない（過去分は遡らない） ---
check("既存ショートカット「牛乳」はまだストックに無い", (await stockNamed("牛乳")) === null);

// --- 新しい品名でよく買うものを登録すると、ストックが自動で作られる ---
await openShortcutRegister();
check("登録シートに「買う間隔」欄が出る", await page.locator("#new-cycle-wrap").isVisible());
await page.fill("#new-name", "柔軟剤");
await page.click("#btn-add-request");
await sleep(1000);

check("よく買うものに登録された",
  (await page.evaluate(async () => {
    const snap = await firebase.database().ref("families/fam1/shortcuts").once("value");
    return Object.values(snap.val() || {}).some((s) => s && s.name === "柔軟剤");
  })));
const created = await stockNamed("柔軟剤");
check("ストックにも自動で作られる", created !== null, JSON.stringify(created));
check("在庫レベルは🟢たっぷりで作られる", created && created.level === "ok");
check("買う間隔を空欄にしたら cycleDays は付かない", created && !created.cycleDays);

// --- 買う間隔を指定して登録すると、ストック側の cycleDays に反映される ---
await openShortcutRegister();
await page.fill("#new-name", "洗濯洗剤");
await page.fill("#new-cycle-days", "20");
await page.click("#btn-add-request");
await sleep(1000);
const withCycle = await stockNamed("洗濯洗剤");
check("買う間隔つきで登録するとストックの cycleDays に入る", withCycle && withCycle.cycleDays === 20, JSON.stringify(withCycle));
check("起点(lastFilledAt)も一緒に入る", withCycle && withCycle.lastFilledAt > 0);

// --- 範囲外の値は弾かれる ---
await openShortcutRegister();
await page.fill("#new-name", "重複チェック用");
await page.fill("#new-cycle-days", "9999");
await page.click("#btn-add-request");
await sleep(600);
check("範囲外の買う間隔はエラーで弾かれる（登録されない）",
  (await page.evaluate(async () => {
    const snap = await firebase.database().ref("families/fam1/shortcuts").once("value");
    return Object.values(snap.val() || {}).some((s) => s && s.name === "重複チェック用");
  })) === false);
await page.click("#btn-sheet-close");
await sleep(400);

// --- 既にストックにある品名で登録すると、重複作成せず既存の買う間隔だけ更新する ---
await openShortcutRegister();
await page.fill("#new-name", "米"); // fb-stub の既存ストック(st1, level:low, cycleDaysなし)と同名
await page.fill("#new-cycle-days", "14");
await page.click("#btn-add-request");
await sleep(1000);
check("同名ストックが重複作成されない", (await stockCountNamed("米")) === 1);
const rice = await stockNamed("米");
check("既存ストックの買う間隔だけ更新される", rice && rice.cycleDays === 14, JSON.stringify(rice));
check("在庫レベルは書き換わらない（🟡残り少ないのまま）", rice && rice.level === "low");

// --- リストの☆から登録した場合は、買う間隔なしでストックだけ自動作成される ---
await page.click('[data-tab="requests"]');
await sleep(500);
await page.click("#btn-add-float");
await sleep(700);
await page.fill("#new-name", "換気扇フィルター");
await page.click("#btn-add-request");
await sleep(1000);
const row = page.locator(".check-row").filter({ hasText: "換気扇フィルター" }).first();
await row.locator(".check-main").click();
await sleep(600);
await page.locator(".check-detail [data-star]").click(); // checkDetail は .check-row の兄弟要素
await sleep(1000);
const starLinked = await stockNamed("換気扇フィルター");
check("☆登録でもストックが自動で作られる", starLinked !== null, JSON.stringify(starLinked));
check("☆登録は買う間隔を指定しない（未設定のまま）", starLinked && !starLinked.cycleDays);

await t.finish();
