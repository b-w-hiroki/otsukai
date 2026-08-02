// 回帰スイートをまとめて実行する。
//   node tests/run-all.mjs            すべて
//   node tests/run-all.mjs lowstock   名前に含むものだけ
//
// 1本ずつ順に走らせる（同時実行するとブラウザが重なってタイムアウトしやすい）。

import { readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || "";
const files = readdirSync(join(HERE, "regression"))
  .filter((f) => f.endsWith(".mjs") && f.includes(filter))
  .sort();

if (!files.length) {
  console.error(`該当するテストがありません: "${filter}"`);
  process.exit(1);
}

const results = [];
for (const f of files) {
  process.stdout.write(`\n──────── ${f} ────────\n`);
  const started = process.hrtime.bigint();
  const r = spawnSync(process.execPath, [join(HERE, "regression", f)], {
    stdio: "inherit",
    // この環境には /opt/pw-browsers に入っている。CI では playwright の既定に任せる。
    env: existsSync("/opt/pw-browsers") && !process.env.PLAYWRIGHT_BROWSERS_PATH
      ? { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "/opt/pw-browsers" }
      : process.env,
  });
  const sec = Number(process.hrtime.bigint() - started) / 1e9;
  results.push({ f, ok: r.status === 0, sec });
}

console.log("\n════════ まとめ ════════");
for (const { f, ok, sec } of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${f.padEnd(26)} ${sec.toFixed(1)}s`);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} / ${results.length} 本パス`);
process.exit(failed.length ? 1 : 0);
