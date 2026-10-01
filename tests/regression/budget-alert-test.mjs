import { startHarness } from "../harness.mjs";

const t = await startHarness({ noAnimation: true, dialogAnswer: "500" });
const { page, sleep } = t;

await t.ready();
await page.evaluate(async () => {
  await firebase.database().ref("families/fam1/requests/r6").update({ budget: 300, actualCost: null });
  await recordActualCost("r6");
});
await sleep(500);

const saved = await page.evaluate(async () =>
  (await firebase.database().ref("families/fam1/requests/r6").once("value")).val()
);
t.check("actual cost keeps its recorder and timestamp", saved.actualCost === 500 && saved.actualCostBy === "uid-parent" && saved.actualCostAt > 0, JSON.stringify(saved));
const toast = await page.locator("#toasts").innerText();
t.check("over-budget entry warns immediately", toast.includes("予算を200円超えています") && toast.includes("500円"), toast);

await t.finish();
