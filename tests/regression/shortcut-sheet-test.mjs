// お買い物ページのフローティングボタン（⚡よく買う）から開く「よく買うもの」簡易シートの検証。
// 下部タブの「よく買う」に気づきにくいという声を受けて追加した導線。
// シートは追加専用（編集モードなし）で、カード/リストの表示切替は下部タブと共通の設定を使う。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

await t.ready();

// --- お買い物タブに「⚡よく買う」のフローティングボタンがある ---
check("フローティングボタンがある", (await page.locator("#btn-shortcut-toggle").count()) === 1);
const btnBox = await page.locator("#btn-shortcut-toggle").boundingBox();
check("タップ領域が44px以上", btnBox.height >= 44, `高さ=${Math.round(btnBox.height)}`);

// --- タップでシートが開き、下部タブと同じ品目が表示される ---
await page.click("#btn-shortcut-toggle");
await sleep(500);
check("シートが開く", await page.locator("#shortcut-sheet.open").isVisible());
check("下部タブと同じ品目が出る（牛乳）", (await page.locator("#shortcut-sheet-chips").innerText()).includes("牛乳"));

// --- シートは追加専用。編集モードのUI（削除×・写真差し替え）が無い ---
check("シートには編集ボタンが無い（下部タブにしか無い）", (await page.locator("#shortcut-sheet .shortcut-card-del, #shortcut-sheet .shortcut-row-del").count()) === 0);

// --- カード/リストの切替がシートにもある。切り替えると下部タブ側にも反映される ---
check("表示切替（カード/リスト）がある", (await page.locator("#shortcut-sheet .shortcut-viewmode-btn").count()) === 2);
check("既定はカード形式", (await page.locator("#shortcut-sheet .shortcut-card").count()) > 0);
await page.click('#shortcut-sheet .shortcut-viewmode-btn[data-viewmode="list"]');
await sleep(400);
check("リスト形式に切り替わる", (await page.locator("#shortcut-sheet .shortcut-row").count()) > 0);
check("カードは消える", (await page.locator("#shortcut-sheet .shortcut-card").count()) === 0);

// --- タップして買い物リストに追加できる（確認ダイアログを経由） ---
const beforeCount = await page.locator(".check-row").count();
await page.locator("#shortcut-sheet .shortcut-row").filter({ hasText: "牛乳" }).first().click();
await sleep(700);
check("確認ダイアログが出る", t.dialogs.some((d) => d.includes("牛乳")), t.dialogs.join("／"));
const afterCount = await page.locator(".check-row").count();
check("買い物リストに追加される", afterCount > beforeCount, `${beforeCount} → ${afterCount}`);

await page.click("#btn-shortcut-sheet-close");
await sleep(400);
check("閉じるボタンで閉じる", !(await page.locator("#shortcut-sheet.open").count()));

// --- 下部タブの「よく買う」でも、シートで選んだリスト形式が引き継がれている ---
await page.click('[data-tab="shortcuts"]');
await sleep(500);
check("下部タブもリスト形式のまま（端末ごとの設定を共有）", (await page.locator("#tab-shortcuts .shortcut-row").count()) > 0);
check("下部タブの表示切替もリストが選択された状態", await page.locator('#tab-shortcuts .shortcut-viewmode-btn[data-viewmode="list"]').evaluate((el) => el.classList.contains("active")));

// カードに戻しておく（他のテストへの影響を避ける・localStorageはテストごとに新しいコンテキストなので
// 本来は不要だが、この後の手動確認等のために分かりやすく戻す）
await page.click('#tab-shortcuts .shortcut-viewmode-btn[data-viewmode="card"]');
await sleep(400);

await t.finish();
