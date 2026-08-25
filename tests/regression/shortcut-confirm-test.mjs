// よく買うものの項目をタップしたときに確認をひとつ挟むことの検証（誤タップ防止）。
// 項目数が増えると隣の項目にうっかり触れて追加してしまいやすくなるため、
// ワンクッション置くことにした。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true, dialogAction: "dismiss" });
const { page, sleep } = t;
const check = t.check;

await t.ready();
await page.click("#btn-shortcut-toggle");
await sleep(500);

const beforeCount = await page.locator(".check-row").count();
const item = page.locator("#shortcut-sheet .shortcut-row").first();
const itemName = await item.locator(".shortcut-row-name").innerText();
await item.click();
await sleep(400);

check("タップすると確認ダイアログが出る", t.dialogs.length === 1, t.dialogs.join("／"));
check("確認ダイアログに品名が入っている", t.dialogs[0]?.includes(itemName), t.dialogs[0]);
check("キャンセルすると買い物リストには追加されない", (await page.locator(".check-row").count()) === beforeCount);

await t.finish();
