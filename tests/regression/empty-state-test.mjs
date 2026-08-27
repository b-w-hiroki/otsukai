// お買い物リストに何も登録が無いときの案内（キャラクター＋吹き出し＋はじめかたの3ステップ）を検証。
import { startHarness } from "../harness.mjs";
const t = await startHarness({ noAnimation: true });
const { page, sleep } = t;
const check = t.check;

await t.ready();

// --- 依頼が1件も無い状態にする（fb-stub の初期データを全部消す） ---
await page.evaluate(async () => {
  await firebase.database().ref("families/fam1/requests").set(null);
});
await sleep(700);

check("キャラクターの案内が出る", (await page.locator(".empty-hero-char").count()) === 1);
check("吹き出しに登録を促す文言が入っている",
  (await page.locator(".empty-hero-bubble").innerText()).includes("登録しよう"));
check("「はじめかた」の3ステップも出る", (await page.locator("#list-open .howto-step").count()) === 3);

// --- 依頼が1件でもあれば、案内は消えて通常のリストになる ---
await page.evaluate(async () => {
  await firebase.database().ref("families/fam1/requests/afterEmpty").set({
    name: "牛乳", diff: "normal", urgent: false, status: "open",
    requestedBy: "uid-mom", requestedAt: Date.now(), category: "food",
  });
});
await sleep(700);
check("依頼が増えると案内は消える", (await page.locator(".empty-hero-char").count()) === 0);
check("通常の買い物リストが出る", (await page.locator(".check-row").count()) === 1);

await t.finish();
