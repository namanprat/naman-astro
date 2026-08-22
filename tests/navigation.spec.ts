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
    await page.locator(".nav_menu_toggle").first().click();
    await expect.poll(() => rootClasses(page)).toContain("menu-open");
    await page.locator('.menu_wrap a[href="/"]').first().click();
  } else {
    await page.locator('.nav_stack a[href="/"]').first().click();
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
 * The About lead has to fill its column, not shrink-to-fit it.
 *
 * `.about_panel_intro` is a column flex box with `align-items: flex-start` and
 * a `display: contents` wrapper, so the heading is itself a flex item. Without
 * an explicit width its size is intrinsic, and WebKit folds the
 * `overflow-wrap: break-word` that `base.css` puts on every heading into its
 * min-content calculation — collapsing the lead to one word per line. It then
 * stays collapsed, because `prepareGooey` splits the heading with SplitText on
 * open and bakes the wrap points into real `.gooey_reveal_line` divs.
 *
 * Blink resolves the same shrink-to-fit to the full column, so this cannot
 * reproduce the Safari rendering. What it can do is lock the geometry the bug
 * needs: an intrinsic width here would be a regression on WebKit whether or
 * not Chromium shows it.
 */
test("the About lead fills its column rather than sizing to its text", async ({
  page,
}) => {
  await page.goto("/");
  await expectRevealed(page);

  await page.evaluate(() => {
    window.location.hash = "#about";
  });
  await expect.poll(() => rootClasses(page)).toContain("about-open");

  const lead = page.locator(".about_panel_lead");
  await expect(lead).toBeVisible();

  const geometry = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".about_panel_lead");
    const column = el?.closest<HTMLElement>(".about_panel_intro");
    if (!el || !column) return null;
    return {
      lead: el.getBoundingClientRect().width,
      column: column.getBoundingClientRect().width,
      words: (el.textContent ?? "").trim().split(/\s+/).length,
      // Zero before the split runs; the reveal bakes one div per line.
      lines: el.querySelectorAll(".gooey_reveal_line").length,
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry!.lead).toBeCloseTo(geometry!.column, 0);
  // The collapse puts every word on its own line, so anything near the word
  // count is the failure this guards.
  if (geometry!.lines > 0) {
    expect(geometry!.lines).toBeLessThan(geometry!.words / 2);
  }
});
