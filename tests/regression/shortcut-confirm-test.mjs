// よく買うものの行をタップしたときに確認をひとつ挟むことの検証（誤タップ防止）。
// 独立タブになって行数が増え、隣の行にうっかり触れて追加してしまいやすくなったため、
// ワンクッション置くことにした。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true, dialogAction: "dismiss" });
const { page, sleep } = t;
const check = t.check;

await t.ready();
await page.click('[data-tab="shortcuts"]');
await sleep(500);

const beforeCount = await page.locator(".check-row").count();
const row = page.locator(".shortcut-row").first();
const rowName = await row.locator(".shortcut-row-name").innerText();
await row.click();
await sleep(400);

check("タップすると確認ダイアログが出る", t.dialogs.length === 1, t.dialogs.join("／"));
check("確認ダイアログに品名が入っている", t.dialogs[0]?.includes(rowName.replace("🔥 ", "")), t.dialogs[0]);
check("キャンセルすると買い物リストには追加されない", (await page.locator(".check-row").count()) === beforeCount);

await t.finish();
