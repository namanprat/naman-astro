import { expect, test } from "@playwright/test";
import {
  expectGalleryRestored,
  galleryDrift,
  galleryMoves,
  isNarrowNav,
  isTouch,
  openNearestProject,
  rootClasses,
  seedSession,
  skipPreloader,
  stubWebGL,
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
      test.skip(
        view === "grid" && isNarrowNav(),
        "phone locks /work to slider; grid is desktop-only",
      );
      await stubWebGL(page);
      await skipPreloader(page);
      await seedSession(page, { "work:view": view });
      await page.goto("/work");
      await expect
        .poll(() => rootClasses(page), { timeout: 30_000 })
        .toContain("page-work");
      await expect(page.locator(".work_wrap")).not.toHaveClass(/is-loading/);
    });

    test("the gallery responds to this device's scroll input", async ({
      page,
      context,
    }) => {
      const cdp = await context.newCDPSession(page);
      expect(await galleryMoves(page, cdp, isTouch())).toBe(true);
    });

    /**
     * A drag and a wheel have to drive the gallery the *same* way.
     *
     * `Observer` reports them on opposite sign conventions — a wheel's
     * `deltaY` is positive scrolling down, a drag's is positive with the
     * finger moving down — and both engines used to add that straight to
     * their scrub. So the wheel was right and every touch ran backwards.
     * `galleryMoves` could not see it: it only asks whether the tiles moved.
     *
     * `touchDrag` sweeps the finger *up*, which is the same intent as a
     * wheel scrolling *down*, so the two readings must share a sign.
     */
    test("a drag and a wheel move the gallery the same way", async ({
      page,
      context,
    }) => {
      test.skip(
        !isTouch(),
        "compares a drag against a wheel, so it needs a touch-capable project",
      );
      const cdp = await context.newCDPSession(page);

      const byDrag = await galleryDrift(page, cdp, true, view);
      const byWheel = await galleryDrift(page, cdp, false, view);

      // A gesture that moved nothing would make the sign check vacuous.
      expect(Math.abs(byDrag)).toBeGreaterThan(0.01);
      expect(Math.abs(byWheel)).toBeGreaterThan(0.01);
      expect(Math.sign(byDrag)).toBe(Math.sign(byWheel));
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
      /* Below 48rem About is a route, so `#about` navigates off /work instead
         of overlaying it — there is no round trip to make, and nothing that
         could leave the gallery's Observer muted. */
      test.skip(isNarrowNav(), "About is a route at this width, not an overlay");

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

test.describe("phone work locks to slider", () => {
  test.skip(
    () => !isNarrowNav(),
    "below 48rem the gallery is slider-only",
  );

  test.beforeEach(async ({ page }) => {
    await stubWebGL(page);
    await skipPreloader(page);
  });

  test("a stored grid view still boots the slider and hides the switcher", async ({
    page,
  }) => {
    await seedSession(page, { "work:view": "grid" });
    await page.goto("/work");
    await expect(page.locator(".work_wrap")).not.toHaveClass(/is-loading/);
    await expect(page.locator(".work_wrap")).toHaveAttribute(
      "data-work-view",
      "slider",
    );
    await expect(page.locator(".work_wrap .view_switcher")).toBeHidden();
  });

  test("a tap on the centered tile opens the project", async ({
    page,
    context,
  }) => {
    await page.goto("/work");
    await expect(page.locator(".work_wrap")).not.toHaveClass(/is-loading/);

    const point = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(
        ".gallery_slide.is-centered",
      );
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return {
        x: Math.round(box.x + box.width / 2),
        y: Math.round(box.y + box.height / 2),
      };
    });
    expect(point, "no centered tile to tap").not.toBeNull();

    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point!.x, y: point!.y }],
    });
    await page.waitForTimeout(40);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await expect
      .poll(() => rootClasses(page), { timeout: 30_000 })
      .toContain("work-project-open");
  });
});

test.describe("the mobile nav", () => {
  test.skip(
    () => !isNarrowNav(),
    "this path is the compact nav below the desktop breakpoint",
  );

  test("reaching WORK through the nav closes the project and frees the scroll", async ({
    page,
    context,
  }) => {
    const cdp = await context.newCDPSession(page);

    await stubWebGL(page);
    await skipPreloader(page);
    await page.goto("/work");
    await expect(page.locator(".work_wrap")).not.toHaveClass(/is-loading/);

    await openNearestProject(page);

    await page.locator('.nav_grid a[href="/work"]').first().click();

    await expectGalleryRestored(page);
    expect(await galleryMoves(page, cdp, isTouch())).toBe(true);
  });
});
