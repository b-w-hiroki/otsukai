import { startHarness } from "../harness.mjs";

const t = await startHarness({ noAnimation: true, authUser: "signed-out" });
const { page, url, check } = t;
for (const width of [320, 390]) {
  for (const scheme of ["light", "dark"]) {
    for (const scale of [1, 2]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(url);
      await page.waitForSelector("#screen-welcome.active");
      // Text-only enlargement, not a device pixel ratio change.
      await page.evaluate(scale => {
        for (const el of document.querySelectorAll(".launch-guide h1, .launch-guide p, .launch-guide li, .launch-guide button")) {
          el.style.fontSize = parseFloat(getComputedStyle(el).fontSize) * scale + "px";
        }
      }, scale);
      const label = width + "/" + scheme + "/" + scale + "x";
      check(label + " no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      check(label + " three semantic noninteractive features", await page.locator(".launch-guide-points li").count() === 3 && await page.locator(".launch-guide-points button, .launch-guide-points a, .launch-guide-points [tabindex]").count() === 0);
      check(label + " explanatory rows have no card chrome", await page.locator(".launch-guide-points li").first().evaluate(el => {
        const s = getComputedStyle(el);
        return s.backgroundColor === "rgba(0, 0, 0, 0)" && s.borderTopWidth === "0px" && s.boxShadow === "none";
      }));
      check(label + " account caveat preserved", await page.locator(".launch-guide-note").innerText() === "初めての方は無料のアカウントを作成します");
      for (const id of ["#btn-welcome-start", "#btn-welcome-login", "#btn-welcome-about"]) {
        await page.locator(id).scrollIntoViewIfNeeded();
        const b = await page.locator(id).boundingBox();
        check(label + " " + id + " reachable 44px target", b && b.height >= 44 && b.x >= 0 && b.x + b.width <= width + 1);
      }
      await page.screenshot({ path: t.OUT + "/welcome-" + width + "-" + scheme + "-" + scale + "x.png", fullPage: true });
    }
  }
}
await page.reload();
await page.waitForSelector("#screen-welcome.active");
await page.keyboard.press("Tab");
check("keyboard skips explanations and starts on primary action", await page.locator("#btn-welcome-start").evaluate(el => el === document.activeElement));
await page.click("#btn-welcome-login");
await page.waitForSelector("#screen-auth.active");
check("login still selects sign-in", await page.locator('[data-auth-mode="signin"]').getAttribute("aria-selected") === "true");
await t.finish();
