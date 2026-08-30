// パフォーマンス最適化の検証。
// - functions-compat SDK は起動時には読み込まず、アカウント削除の操作時に動的に読み込む
// - 一覧の写真サムネイルは loading="lazy"
// - 「引っ張って更新」は家族データのリスナーを張り直さない（既にリアルタイム同期済みのため）
import { startHarness } from "../harness.mjs";
// アカウント削除は誤操作防止のため "delete" と入力させる最終確認（prompt）を挟むので、
// 自動テストではその入力を用意しておく（確認ダイアログ側は confirm なので影響しない）
const t = await startHarness({ noAnimation: true, dialogAnswer: "delete" });
const { page, sleep } = t;
const check = t.check;

await t.ready();

// --- 起動時に functions-compat.js を読み込んでいない ---
const functionsScriptLoaded = await page.evaluate(() =>
  Array.from(document.scripts).some((s) => s.src.includes("firebase-functions-compat")));
check("起動時は functions-compat.js を読み込まない", !functionsScriptLoaded);

// --- アカウント削除の操作で動的に読み込まれ、実際に呼び出しまで届く ---
await page.click('[data-tab="settings"]');
await sleep(500);
await page.click('.settings-acc[data-acc="member-admin"] [data-acc-toggle]');
await sleep(400);
await page.click("#btn-member-admin-toggle");
await sleep(400);
const deleteBtn = page.locator("[data-admin-delete]").first();
check("メンバー管理にアカウント削除ボタンがある", (await deleteBtn.count()) > 0);
await deleteBtn.click();
await sleep(600);
const scriptLoadedAfter = await page.evaluate(() =>
  Array.from(document.scripts).some((s) => s.src.includes("firebase-functions-compat")));
check("操作すると functions-compat.js が動的に読み込まれる", scriptLoadedAfter);
const toast = await page.locator("#toasts").innerText().catch(() => "");
check("SDKの読み込み自体は成功し、実際の呼び出しまで届く（スタブ未デプロイのエラーになる）",
  toast.includes("functions未デプロイ"), toast.replace(/\n/g, " ").slice(0, 60));
check("SDK読み込み失敗のエラーメッセージにはならない", !toast.includes("通信環境"));

// --- 一覧の写真サムネイルは loading=lazy ---
await page.click('[data-tab="requests"]');
await sleep(500);
const thumbLazy = await page.locator(".photo-thumb img").first().getAttribute("loading").catch(() => null);
check("お買い物リストの写真サムネイルは loading=lazy", thumbLazy === "lazy", thumbLazy);

await page.click('[data-tab="stock"]');
await sleep(500);
const stockImgCount = await page.locator(".stock-img").count();
if (stockImgCount > 0) {
  const stockLazy = await page.locator(".stock-img").first().getAttribute("loading");
  check("ストック一覧の写真も loading=lazy", stockLazy === "lazy", stockLazy);
} else {
  check("ストック一覧の写真も loading=lazy（対象品目なしのためスキップ）", true);
}

// --- 引っ張って更新は家族データのリスナーを張り直さない ---
await page.click('[data-tab="settings"]');
await sleep(500);
await page.click('.settings-acc[data-acc="maintenance"] [data-acc-toggle]');
await sleep(400);
await page.evaluate(() => {
  window.__attachCalls = 0;
  const orig = window.attachFamilyListeners;
  window.attachFamilyListeners = function (...args) { window.__attachCalls++; return orig.apply(this, args); };
});
await page.click("#btn-refresh-data");
await sleep(1500);
const calls = await page.evaluate(() => window.__attachCalls);
check("「データを再読み込み」は家族データのリスナーを張り直さない", calls === 0, `attachFamilyListeners呼び出し回数=${calls}`);

await t.finish();
