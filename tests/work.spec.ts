import { expect, test } from "@playwright/test";
import {
  expectGalleryRestored,
  galleryMoves,
  isNarrowNav,
  isTouch,
  openNearestProject,
  rootClasses,
  gestureDirection,
  seedSession,
  skipPreloader,
  stubWebGL,
  swipe,
  wheelBy,
} from "./helpers";

/**
 * The `/work` round trip.
 *
 * `html.page-work` is `overflow: hidden; touch-action: none`, so there is no
 * document scroller: a single GSAP `Observer` per engine is the whole of the
 * gallery's scroll input, and it is disabled the moment a project opens. Only a
 * completed `Transition.reset()` turns it back on. Every path out of a
 * transition therefore has to reach that, and every gate in `engineEnabled()`
 * has to come back down — otherwise the page looks entirely normal and just
 * stops responding.
 */
for (const view of ["slider", "grid"] as const) {
  test.describe(`${view} view`, () => {
    test.beforeEach(async ({ page }) => {
      await stubWebGL(page);
      await skipPreloader(page);
      await seedSession(page, { "work:view": view });
      await page.goto("/work");
      await expect
        .poll(() => rootClasses(page), { timeout: 30_000 })
        .toContain("page-work");
      await expect(page.locator(".work-page")).not.toHaveClass(/is-loading/);
    });

    test("the gallery responds to this device's scroll input", async ({
      page,
      context,
    }) => {
      const cdp = await context.newCDPSession(page);
      expect(await galleryMoves(page, cdp, isTouch())).toBe(true);
    });

    /**
     * Regression: a swipe used to drive the gallery backwards.
     *
     * Observer reports a wheel's `deltaY` as scroll intent and a drag's as finger
     * travel, which are opposite for the same request. Both engines read the raw
     * delta, so touch ran inverted while the wheel was right — and `galleryMoves`
     * could not see it, because it only asks whether anything moved.
     *
     * Asserted as agreement between the two devices rather than against a fixed
     * direction: which way "forward" looks is the engine's business, but a wheel
     * down and a swipe up are the same request and have to land the same way.
     */
    test("a swipe up drives the gallery the same way a wheel down does", async ({
      page,
      context,
    }) => {
      // Needs both devices in one run to compare them, so it wants a project
      // with `hasTouch` — a mouse-only context drops dispatched touch events.
      test.skip(!isTouch(), "no touch input on this device");

      const cdp = await context.newCDPSession(page);
      const distance = Math.round(page.viewportSize()!.height * 0.35);

      const byWheel = await gestureDirection(page, view, () =>
        wheelBy(page, distance),
      );
      expect(byWheel, "the wheel did not move the gallery").not.toBe(0);

      // Fresh gallery: the ring and the loop both carry state across a gesture.
      await page.reload();
      await expect(page.locator(".work-page")).not.toHaveClass(/is-loading/);

      const bySwipe = await gestureDirection(page, view, () =>
        swipe(page, cdp, -distance),
      );
      expect(bySwipe, "the swipe did not move the gallery").not.toBe(0);

      expect(bySwipe).toBe(byWheel);
    });

    test("closing a project restores the URL and the scroll", async ({
      page,
      context,
    }) => {
      const cdp = await context.newCDPSession(page);
      const touch = isTouch();

      await openNearestProject(page);

      if (isNarrowNav()) {
        // Below the nav breakpoint WORK has no BACK state; the menu owns it.
        await page.evaluate(() =>
          window.dispatchEvent(new CustomEvent("work:close")),
        );
      } else {
        await page.locator('.nav_grid a[href="/work"]').click();
      }

      await expectGalleryRestored(page);
      expect(await galleryMoves(page, cdp, touch)).toBe(true);
    });

    test("browser Back closes the project and leaves the URL on /work", async ({
      page,
      context,
    }) => {
      const cdp = await context.newCDPSession(page);
      const touch = isTouch();

      await openNearestProject(page);
      await page.goBack();

      await expectGalleryRestored(page);
      expect(await galleryMoves(page, cdp, touch)).toBe(true);
    });

    /**
     * Regression: Back onto a *stale* project entry, with nothing open.
     *
     * Opening pushes `/work/[slug]` and closing pushes `/work` on top, so one
     * completed round trip leaves the stack as `/work`, `/work/[slug]`,
     * `/work` — and the Back from there lands on a project URL with the
     * gallery already on screen and no transition to close. Nothing reconciled
     * that, so the address stayed on a project the gallery had come back from,
     * and `isInPageMenuNav` then stopped reading WORK as an in-page close and
     * hard-reloaded the page, replaying the whole reverse Flip.
     *
     * Distinct from the test above, which presses Back while a project is
     * genuinely open — that path always had a close to run.
     */
    test("Back onto a stale project entry corrects the URL", async ({
      page,
      context,
    }) => {
      const cdp = await context.newCDPSession(page);
      const touch = isTouch();

      await openNearestProject(page);
      await page.evaluate(() =>
        window.dispatchEvent(new CustomEvent("work:close")),
      );
      await expectGalleryRestored(page);

      // Nothing is open, so this pops straight onto the project entry left
      // behind by the round trip.
      await page.goBack();

      await expectGalleryRestored(page);
      expect(await galleryMoves(page, cdp, touch)).toBe(true);
    });

    test("an About round trip leaves the gallery scrollable", async ({
      page,
      context,
    }) => {
      const cdp = await context.newCDPSession(page);
      const touch = isTouch();

      await page.evaluate(() => {
        window.location.hash = "#about";
      });
      await expect
        .poll(() => rootClasses(page), { timeout: 30_000 })
        .toContain("about-open");

      await page.keyboard.press("Escape");
      await expect
        .poll(() => rootClasses(page), { timeout: 30_000 })
        .not.toContain("about-open");

      expect(await galleryMoves(page, cdp, touch)).toBe(true);
    });
  });
}

test.describe("returning from a hard-loaded project page", () => {
  test.beforeEach(async ({ page }) => {
    await stubWebGL(page);
    await skipPreloader(page);
  });

  test("the reverse Flip lands and the gallery scrolls", async ({
    page,
    context,
  }) => {
    const cdp = await context.newCDPSession(page);

    await page.goto("/work/money-me");
    await expect.poll(() => rootClasses(page)).toContain("page-work-project");

    if (isNarrowNav()) {
      // The nav link is the same element at every width; below the breakpoint
      // it is the menu that normally surfaces it.
      await page.evaluate(() => {
        try {
          sessionStorage.setItem("work:return", "money-me");
        } catch {
          /* private mode */
        }
      });
      await page.goto("/work");
    } else {
      await page.locator('.nav_grid a[href="/work"]').click();
    }

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
      .toBe("/work");
    // `work-returning` holds the gallery at opacity 0 until the reverse starts;
    // a boot that never clears it leaves the page looking empty.
    await expect
      .poll(() => rootClasses(page), { timeout: 30_000 })
      .not.toContain("work-returning");
    await expect(page.locator(".gallery")).toHaveCSS("opacity", "1");

    expect(await galleryMoves(page, cdp, isTouch())).toBe(true);
  });
});

test.describe("the mobile menu", () => {
  test.skip(
    () => !isNarrowNav(),
    "the overlay menu only exists below the nav breakpoint",
  );

  test("reaching WORK through the menu closes the project and frees the scroll", async ({
    page,
    context,
  }) => {
    const cdp = await context.newCDPSession(page);

    await stubWebGL(page);
    await skipPreloader(page);
    await page.goto("/work");
    await expect(page.locator(".work-page")).not.toHaveClass(/is-loading/);

    await openNearestProject(page);

    await page.locator(".nav-menu-toggle").first().click();
    await expect.poll(() => rootClasses(page)).toContain("menu-open");

    await page.locator('.menu a[href="/work"]').first().click();

    // `menu-open` is one of `engineEnabled()`'s gates, and it comes off at the
    // end of a 0.9s close — well after `work:close` has already fired.
    await expect
      .poll(() => rootClasses(page), { timeout: 30_000 })
      .not.toContain("menu-open");
    await expectGalleryRestored(page);
    expect(await galleryMoves(page, cdp, isTouch())).toBe(true);
  });
});
