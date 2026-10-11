import { startHarness } from "../harness.mjs";

const t = await startHarness({ noAnimation: true, authUser: "signed-out" });
const { page, url } = t;
const check = t.check;

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#screen-welcome.active");
check("first signed-out launch shows the app name", await page.locator("#launch-guide-title").textContent() === "おうちのおつかい");
check("welcome explains the purpose", (await page.locator(".launch-guide-lead").textContent()).includes("家族みんな"));
check("welcome offers start and login", await page.locator("#btn-welcome-start, #btn-welcome-login").count() === 2);
for (const id of ["#btn-welcome-start", "#btn-welcome-login", "#btn-welcome-about"]) {
  const box = await page.locator(id).boundingBox();
  check(`${id} has a 44px tap target`, box && box.height >= 44, box ? `${box.width}x${box.height}` : "none");
}
check("welcome has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

await page.click("#btn-welcome-about");
check("about opens as a modal", await page.locator("#app-about-dialog").evaluate((d) => d.open));
await page.goBack();
check("browser back closes about", !(await page.locator("#app-about-dialog").evaluate((d) => d.open)));
await page.click("#btn-welcome-start");
await page.waitForSelector("#screen-auth.active");
check("start opens sign-up", await page.locator('[data-auth-mode="signup"]').getAttribute("aria-selected") === "true");
await page.reload();
await page.waitForSelector("#screen-auth.active");
check("restart skips the first-launch guide", await page.locator("#screen-welcome.active").count() === 0);

await t.finish();
