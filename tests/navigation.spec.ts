import { expect, test } from "@playwright/test";
import {
  expectNavVisible,
  expectRevealed,
  isNarrowNav,
  rootClasses,
  skipPreloader,
  stubWebGL,
} from "./helpers";

/** Home's in-page section jumps and the About panel, which lives on every route. */
test.beforeEach(async ({ page }) => {
  await stubWebGL(page);
  await skipPreloader(page);
});

test("the homepage scrolls", async ({ page }) => {
  await page.goto("/");
  await expectRevealed(page);

  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 900);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
});

/**
 * Getting back to the top of the homepage, through whichever surface the width
 * actually offers.
 *
 * The nav stack and the overlay menu swap at exactly the 64rem breakpoint, so
 * neither path is testable on its own: above it the menu toggle is hidden and
 * the section links live in `.nav_grid`; below it the reverse. Both end in
 * `goTo("/")`, which does not navigate when already on `/` — it replays the
 * hero entrance and scrolls to the top.
 */
test("returning Home scrolls to the top and keeps the nav up", async ({
  page,
}) => {
  await page.goto("/");
  await expectRevealed(page);

  const openMenu = async () => {
    await page.locator(".nav-menu-toggle").first().click();
    await expect.poll(() => rootClasses(page)).toContain("menu-open");
  };

  if (isNarrowNav()) {
    // Contact is the only menu entry that scrolls: Home goes to the top, Work
    // and Archive are routes, and About opens the panel instead.
    await openMenu();
    await page.locator('.menu a[href="/#contact"]').first().click();
  } else {
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 2000);
  }

  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 30_000 })
    .toBeGreaterThan(0);

  if (isNarrowNav()) {
    await expect
      .poll(() => rootClasses(page), { timeout: 30_000 })
      .not.toContain("menu-open");
    await openMenu();
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
