// おうちのおつかい — E2E スモークテスト
// アプリをヘッドレス Chromium で開き、以下を確認する:
//   1. ページが読み込まれ、認証画面（#screen-auth）が表示されること
//      （= Firebase SDK・firebase-config.js・app.js の読み込みと初期化が成功）
//   2. 未捕捉の JS 例外（pageerror）がゼロであること
// 広告・フォント等のネットワーク由来の console エラーは失敗にしない（ログのみ）。
//
// 実行: node tests/smoke.mjs
// 必要: npm i playwright（CI では playwright install chromium も）

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
};

const server = http.createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = join(ROOT, path === "/" ? "index.html" : path.replace(/^\/+/, ""));
    if (!file.startsWith(normalize(ROOT))) throw new Error("traversal");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();

const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

let failed = false;
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  // 認証画面が出る = SDK 読み込み → firebase 初期化 → onAuthStateChanged(null) まで到達
  await page.waitForSelector("#screen-auth.active", { timeout: 20000 });
  console.log("OK: auth screen visible");

  if (pageErrors.length) {
    console.error("FAIL: uncaught page errors:");
    for (const e of pageErrors) console.error("  " + e);
    failed = true;
  } else {
    console.log("OK: no uncaught page errors");
  }
  if (consoleErrors.length) {
    console.log(`note: ${consoleErrors.length} console error(s) (network noise is tolerated):`);
    for (const e of consoleErrors.slice(0, 5)) console.log("  " + e.slice(0, 200));
  }
} catch (e) {
  console.error("FAIL: " + e.message);
  if (pageErrors.length) for (const err of pageErrors) console.error("  pageerror: " + err);
  failed = true;
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
