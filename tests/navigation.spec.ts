import { expect, test } from "@playwright/test";
import {
  expectNavVisible,
  expectRevealed,
  isNarrowNav,
  isTouch,
  rootClasses,
  scrollDown,
  skipPreloader,
  stubWebGL,
} from "./helpers";

/** Home's in-page section jumps and the About panel, which lives on every route. */
test.beforeEach(async ({ page }) => {
  await stubWebGL(page);
  await skipPreloader(page);
});

test("the homepage scrolls", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);

  await page.goto("/");
  await expectRevealed(page);

  // A real finger drag on the touch projects: the homepage runs Lenis over the
  // document scroller, and wheel and touch reach it by different routes.
  await scrollDown(page, cdp, isTouch());
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 30_000 })
    .toBeGreaterThan(0);
});

/**
 * Scroll the homepage with this device's own input, then get back to the top
 * through whichever surface the width actually offers.
 *
 * The nav stack and the overlay menu swap at exactly the 64rem breakpoint —
 * above it the menu toggle is hidden and the links live in `.nav_grid`, below
 * it the reverse — so Home has to be reached differently on each side. Both
 * ends land in `goTo("/")`, which does not navigate when already on `/`: it
 * replays the hero entrance and scrolls to the top, which is the path that
 * regressed.
 */
test("returning Home scrolls to the top and keeps the nav up", async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  const narrow = isNarrowNav();

  await page.goto("/");
  await expectRevealed(page);

  await scrollDown(page, cdp, isTouch());
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 30_000 })
    .toBeGreaterThan(0);

  if (narrow) {
    await page.locator(".nav-menu-toggle").first().click();
    await expect.poll(() => rootClasses(page)).toContain("menu-open");
    await page.locator('.menu a[href="/"]').first().click();
  } else {
    await page.locator('.nav-stack a[href="/"]').first().click();
  }

  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 30_000 })
    .toBe(0);
  await expect
    .poll(() => rootClasses(page), { timeout: 30_000 })
    .not.toContain("menu-open");
  await expectNavVisible(page);
});

test("About opens and closes without stranding its state", async ({ page }) => {
  await page.goto("/");
  await expectRevealed(page);

  await page.evaluate(() => {
    window.location.hash = "#about";
  });
  await expect.poll(() => rootClasses(page)).toContain("about-open");

  await page.keyboard.press("Escape");
  // Driven by the panel's `open` prop rather than the exit animation, so an
  // interrupted close cannot leave it behind. `WorkGallery` mutes the gallery's
  // wheel while it is set.
  await expect
    .poll(() => rootClasses(page), { timeout: 30_000 })
    .not.toContain("about-open");
});

/**
 * Regression: the lead's gooey was parked on every run of the open effect but
 * revealed only on the closed-to-open edge. `Menu` changes the panel's mode
 * while it is open whenever the viewport crosses 64rem, so a resize re-blurred
 * copy that had already settled with nothing left to clear it — and the lead
 * stayed blurred until the panel was closed and reopened.
 */
test("About lead does not re-blur when a resize changes the panel mode", async ({
  page,
}) => {
  await page.goto("/");
  await expectRevealed(page);

  await page.evaluate(() => {
    window.location.hash = "#about";
  });
  await expect
    .poll(() => rootClasses(page), { timeout: 30_000 })
    .toContain("about-open");

  const lead = page.locator(".about-panel__lead");
  await expect(lead).toBeVisible();

  const blur = () =>
    lead.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>(".gooey-reveal__inner")].map(
        (inner) => inner.style.getPropertyValue("--gooey-blur") || "0px",
      ),
    );

  // Let the entrance land, so anything left over afterwards is a regression.
  await expect
    .poll(() => blur().then((v) => v.every((b) => parseFloat(b) === 0)), {
      timeout: 30_000,
    })
    .toBe(true);

  // Cross the nav breakpoint in both directions — `Menu` retargets the mode
  // each way, and each retarget re-ran the effect that used to re-park.
  const { width, height } = page.viewportSize()!;
  const across = width >= 1024 ? 800 : 1280;
  await page.setViewportSize({ width: across, height });
  await page.waitForTimeout(600);
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(600);

  expect(
    (await blur()).every((b) => parseFloat(b) === 0),
    "the About lead is still carrying a parked blur",
  ).toBe(true);
});
