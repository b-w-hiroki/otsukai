// よく買うものカードをタップしたときに確認をひとつ挟むことの検証（誤タップ防止）。
// 独立タブになって項目数が増え、隣のカードにうっかり触れて追加してしまいやすく
// なったため、ワンクッション置くことにした。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true, dialogAction: "dismiss" });
const { page, sleep } = t;
const check = t.check;

await t.ready();
await page.click('[data-tab="shortcuts"]');
await sleep(500);

const beforeCount = await page.locator(".check-row").count();
const card = page.locator(".shortcut-card").first();
const cardName = await card.locator(".shortcut-card-name").innerText();
await card.click();
await sleep(400);

check("タップすると確認ダイアログが出る", t.dialogs.length === 1, t.dialogs.join("／"));
check("確認ダイアログに品名が入っている", t.dialogs[0]?.includes(cardName), t.dialogs[0]);
check("キャンセルすると買い物リストには追加されない", (await page.locator(".check-row").count()) === beforeCount);

await t.finish();
