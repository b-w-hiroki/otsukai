// お買い物ページのフローティングボタン（⚡よく買う）から開く「よく買うもの」シートの検証。
// 下部タブを廃止し、登録・編集を含む全機能をこのシートに一本化した
// （編集モードなど詳しい検証は shortcut-tab-test.mjs 側で行う。ここではシート自体の
// 開閉・タップでの追加・表示切替の永続化を確認する）。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

await t.ready();

// --- お買い物ページに「⚡よく買う」のフローティングボタンがある ---
check("フローティングボタンがある", (await page.locator("#btn-shortcut-toggle").count()) === 1);
const btnBox = await page.locator("#btn-shortcut-toggle").boundingBox();
check("タップ領域が44px以上", btnBox.height >= 44, `高さ=${Math.round(btnBox.height)}`);

// --- タップでシートが開き、登録済みの品目が表示される ---
await page.click("#btn-shortcut-toggle");
await sleep(500);
check("シートが開く", await page.locator("#shortcut-sheet.open").isVisible());
check("登録済みの品目が出る（牛乳）", (await page.locator("#shortcut-sheet-chips").innerText()).includes("牛乳"));

// --- カード/リストの切替がある ---
check("表示切替（カード/リスト）がある", (await page.locator("#shortcut-sheet .shortcut-viewmode-btn").count()) === 2);
check("既定はリスト形式", (await page.locator("#shortcut-sheet .shortcut-row").count()) > 0);
await page.click('#shortcut-sheet .shortcut-viewmode-btn[data-viewmode="card"]');
await sleep(400);
check("カード形式に切り替わる", (await page.locator("#shortcut-sheet .shortcut-card").count()) > 0);
check("リストは消える", (await page.locator("#shortcut-sheet .shortcut-row").count()) === 0);

// --- タップして買い物リストに追加できる（確認ダイアログを経由） ---
const beforeCount = await page.locator(".check-row").count();
await page.locator("#shortcut-sheet .shortcut-card").filter({ hasText: "牛乳" }).first().click();
await sleep(700);
check("確認ダイアログが出る", t.dialogs.some((d) => d.includes("牛乳")), t.dialogs.join("／"));
const afterCount = await page.locator(".check-row").count();
check("買い物リストに追加される", afterCount > beforeCount, `${beforeCount} → ${afterCount}`);

await page.click("#btn-shortcut-sheet-close");
await sleep(400);
check("閉じるボタンで閉じる", !(await page.locator("#shortcut-sheet.open").count()));

// --- 表示切替は端末に記憶され、閉じて開き直しても引き継がれる ---
await page.click("#btn-shortcut-toggle");
await sleep(500);
check("再度開いてもカード形式のまま", (await page.locator("#shortcut-sheet .shortcut-card").count()) > 0);
check("表示切替もカードが選択された状態", await page.locator('#shortcut-sheet .shortcut-viewmode-btn[data-viewmode="card"]').evaluate((el) => el.classList.contains("active")));

// リストに戻しておく（既定と揃える。localStorageはテストごとに新しいコンテキストなので本来は
// 不要だが、この後の手動確認等のために分かりやすく戻す）
await page.click('#shortcut-sheet .shortcut-viewmode-btn[data-viewmode="list"]');
await sleep(400);

await t.finish();
