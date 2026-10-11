import { startHarness } from "../harness.mjs";

const t = await startHarness({ noAnimation: true, authDelayMs: 700 });
const { page, url } = t;
const check = t.check;

await page.goto(url, { waitUntil: "domcontentloaded" });
check("session restoration keeps the loading screen visible", await page.locator("#screen-loading.active").count() === 1);
check("login and welcome do not flash during restoration", await page.locator("#screen-auth.active, #screen-welcome.active").count() === 0);
await page.waitForSelector("#screen-main.active", { timeout: 5000 });
check("signed-in user reaches the app", await page.locator("#screen-main.active").count() === 1);

await t.finish();
