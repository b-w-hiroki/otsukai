// 回帰テスト共通のハーネス。
//
// なぜサーバー側で URL を書き換えるか:
//   Playwright の page.route は **Service Worker 発のリクエストを横取りできない**。
//   Firebase SDK を gstatic から読む間に SW が挟まると、スタブではなく本物を取りに行って
//   テストがネットワーク依存になる。そこでテストサーバー側で gstatic の URL を
//   同一オリジンの /__fb/ に書き換え、そこにスタブを返す。
//
// 使い方:
//   import { startHarness } from "./harness.mjs";
//   const t = await startHarness();
//   await t.ready();                       // 起動してメイン画面が出るまで待つ
//   t.check("何かが起きる", 条件, "補足");
//   await t.finish();                      // 結果を出して exit code を返す

import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

export async function startHarness(opts = {}) {
  const {
    label = "FAIL",          // 失敗時の見出し（bughunt は "BUG"）
    noAnimation = false,     // 出現アニメ中は要素が not stable でクリックできない
    dialogAnswer = null,     // prompt に自動で返す値（null なら accept のみ）
    dialogAction = "accept", // "dismiss" にすると confirm をキャンセルする
    touch = true,            // .tap() と実タッチのスワイプを使えるようにする
    shots = join(HERE, "shots"),
    // 配信するテキストを差し替えるフック。(相対パス, 中身) => 中身
    // 更新テストが「デプロイでバージョンが上がった状況」を作るのに使う。
    transform = null,
  } = opts;

  const stub = await readFile(join(HERE, "fb-stub.js"), "utf8");
  const ocrStub = await readFile(join(HERE, "ocr-stub.js"), "utf8");
  const server = http.createServer(async (req, res) => {
    try {
      const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (p.startsWith("/__fb/")) {
        res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" });
        return res.end(p.includes("firebase-app-compat") ? stub : "//");
      }
      if (p.startsWith("/__ocr/")) {
        res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" });
        return res.end(ocrStub);
      }
      const f = join(ROOT, p === "/" ? "index.html" : p.replace(/^\/+/, ""));
      if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      let b = await readFile(f);
      if (f.endsWith("index.html")) {
        b = Buffer.from(
          String(b)
            .replace(/https:\/\/www\.gstatic\.com\/firebasejs\/9\.23\.0\//g, "/__fb/")
            .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@5\.1\.1\/dist\/tesseract\.min\.js/g, "/__ocr/tesseract.min.js")
            .replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/g, ""),
          "utf-8"
        );
      }
      if (transform && /\.(js|html|css|json)$/.test(f)) {
        const out = transform(f.slice(ROOT.length + 1), String(b));
        if (out != null) b = Buffer.from(out, "utf-8");
      }
      res.writeHead(200, {
        "content-type": MIME[extname(f)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(b);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/`;

  // この実行環境には Chromium が /opt/pw-browsers に置いてある。
  // CI では playwright が自前で入れるので、無ければ既定の解決に任せる。
  const preinstalled = "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(
    existsSync(preinstalled) ? { executablePath: preinstalled } : {}
  );
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await ctx.newPage();

  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    if (dialogAction === "dismiss") d.dismiss();
    else d.accept(dialogAnswer ?? undefined);
  });

  if (noAnimation) {
    await page.addInitScript(() => {
      const st = document.createElement("style");
      st.textContent = "*{animation:none !important;transition:none !important;}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
    });
  }

  await mkdir(shots, { recursive: true });

  let fail = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const t = {
    url, server, browser, ctx, page, errs, sleep, OUT: shots,
    /** 最後に出たダイアログの本文 */
    lastDialog: () => dialogs[dialogs.length - 1] || "",
    dialogs,
    clearDialogs() { dialogs.length = 0; },
    /**
     * 実タッチのスワイプ。マウスホイールでは overflow の慣性スクロールを再現できず
     * 「sticky だから見えているはず」で見落とすため、CDP で本物のタッチを送る。
     */
    swipeDown(x, yFrom, yTo, steps = 14) { return this.swipe(x, yFrom, yTo, steps); },
    swipeUp(x, yFrom, yTo, steps = 14) { return this.swipe(x, yFrom, yTo, steps); },
    async swipe(x, yFrom, yTo, steps = 14) {
      const cdp = await ctx.newCDPSession(page);
      const send = (type, y) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y }],
        });
      await send("touchStart", yFrom);
      for (let i = 1; i <= steps; i++) {
        await send("touchMove", yFrom + ((yTo - yFrom) * i) / steps);
        await new Promise((r) => setTimeout(r, 16));
      }
      await send("touchEnd");
      await cdp.detach();
    },
    /** 実タッチの左右スワイプ（ページ内タブの切替検証などに使う） */
    swipeLeft(y, xFrom, xTo, steps = 14) { return this.swipeX(y, xFrom, xTo, steps); },
    swipeRight(y, xFrom, xTo, steps = 14) { return this.swipeX(y, xFrom, xTo, steps); },
    async swipeX(y, xFrom, xTo, steps = 14) {
      const cdp = await ctx.newCDPSession(page);
      const send = (type, x) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y }],
        });
      await send("touchStart", xFrom);
      for (let i = 1; i <= steps; i++) {
        await send("touchMove", xFrom + ((xTo - xFrom) * i) / steps);
        await new Promise((r) => setTimeout(r, 16));
      }
      await send("touchEnd");
      await cdp.detach();
    },
    check(name, ok, extra = "") {
      console.log((ok ? "OK  " : label.padEnd(4)) + " | " + name + (extra ? " — " + extra : ""));
      if (!ok) fail++;
      return ok;
    },
    /** 起動してメイン画面が出るまで待つ */
    async ready(wait = 1200) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#screen-main", { state: "visible", timeout: 20000 });
      await sleep(wait);
    },
    async shot(name) { await page.screenshot({ path: join(shots, name + ".png") }); },
    /**
     * 履歴シートを開く。買い物ページのフロート列から「履歴」を外したため、
     * プレイヤー情報シート（アバター）経由になった。裏に残る player-sheet の
     * "open" だけを外す（closePlayerSheet() だと sheet-backdrop の "open" も
     * 一緒に外れてしまい、直後に開いた history-sheet 側の背景が効かなくなる
     * ため使わない。sheet-backdrop は複数シートで共有している）。
     */
    async openHistory() {
      await page.click("#btn-player-profile");
      await sleep(300);
      await page.click("#ps-btn-history");
      await page.evaluate(() => document.getElementById("player-sheet").classList.remove("open"));
    },
    /** 結果を出して後始末。未捕捉エラーがあれば失敗扱い */
    async finish({ failOnPageError = true } = {}) {
      console.log("\n未捕捉エラー: " + errs.length);
      errs.forEach((e) => console.log("  " + e));
      const bad = fail + (failOnPageError ? errs.length : 0);
      console.log(bad ? `\n=== ${fail} FAILED ===` : "\n=== ALL PASS ===");
      await browser.close();
      server.close();
      process.exit(bad ? 1 : 0);
    },
  };
  return t;
}
