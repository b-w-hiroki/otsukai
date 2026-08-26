// お買い物タブの赤バッジ（badge-requests）は「一度お買い物タブを見たら消える」仕様。
// 家族からの新しい依頼だけを、既読時刻（端末ローカル）より後のものとして数える。
// 見た後は同じ依頼がずっと未完了のままでも再表示されない（新着があれば別途出る）。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

const badgeText = async () => {
  const badge = page.locator("#badge-requests");
  const visible = await badge.isVisible().catch(() => false);
  return visible ? (await badge.innerText()).trim() : "";
};

await t.ready(); // 初期表示はお買い物タブ（既存の未完了3件はここで既読になる）

// --- ストックタブへ移ると、既存の未完了依頼では赤バッジが出ない（起動時に見た扱いのため） ---
await page.click('[data-tab="stock"]');
await sleep(400);
check("既存の未完了だけでは赤バッジが出ない", (await badgeText()) === "");

// --- 家族が新しく依頼を追加すると、赤バッジが出る ---
await page.evaluate(async () => {
  await firebase.database().ref("families/fam1/requests/newReq1").set({
    name: "しょうゆ", diff: "normal", urgent: false, status: "open",
    requestedBy: "uid-mom", requestedAt: Date.now(), category: "food",
  });
});
await sleep(700);
check("新しい依頼で赤バッジが出る", (await badgeText()) === "1", await badgeText());

// --- お買い物タブを開くと、それまでの依頼はすべて既読になる ---
await page.click('[data-tab="requests"]');
await sleep(400);
check("お買い物タブを見ている間は赤バッジが出ない", (await badgeText()) === "");

// --- 他のタブへ戻っても、見た依頼ではもう赤バッジが出ない ---
await page.click('[data-tab="stock"]');
await sleep(400);
check("見た依頼では再表示されない", (await badgeText()) === "");

await t.finish();
