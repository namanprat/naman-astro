import { expect, test } from "@playwright/test";
import {
  expectNavVisible,
  expectRevealed,
  isNarrowNav,
  isTouch,
  rootClasses,
  scrollDown,
  seedSession,
  skipPreloader,
  stubWebGL,
} from "./helpers";

/**
 * The page entrance, on every device.
 *
 * Everything visible on a fresh load hangs off one promise — `bootIfCovered()`
 * in `BaseLayout` — which marks the page revealed and then boots the heading
 * gooey and the line reveal. Three different things resolve it: a plain load,
 * the preloader's ENTER, and an inbound page-transition cover. Only the middle
 * one runs on the very first visit of a browser session, which is why a break
 * there was invisible on every reload and every return trip.
 */
test.beforeEach(async ({ page }) => {
  await stubWebGL(page);
});

/**
 * The slowest test here by a wide margin, and none of it is the site's doing.
 *
 * It is the only one that cannot skip the preloader, so it waits on the real
 * asset load, and then on a 0.9s exit that is frame-*count* bound rather than
 * time bound: GSAP's default lag smoothing advances a tween by at most 33ms per
 * tick, so the exit needs ~27 frames however long each one takes. Headless
 * Chromium here throttles rAF hard unless something is already driving frames —
 * measured, the same exit runs in 1.0s at 59fps with a rAF loop present and
 * ~15s without one. On a real browser with a compositor it is 0.9s.
 *
 * So the budget is sized for the environment, not for the animation.
 */
test("cold session: the preloader hands over and the nav appears", async ({
  page,
}) => {
  test.setTimeout(240_000);

  // No seeding: this is the once-per-session path, keyed on `preload:seen`.
  await page.goto("/");

  const cta = page.locator("[data-preload-cta]");
  await expect(cta).toHaveAttribute("data-ready", "1", { timeout: 60_000 });
  await cta.click();

  await expect(page.locator(".preloader_wrap")).toHaveCount(0, { timeout: 90_000 });
  await expectRevealed(page);
  await expectNavVisible(page);
});

test("second visit in the same session skips the preloader and still reveals", async ({
  page,
}) => {
  await skipPreloader(page);
  await page.goto("/");

  await expect(page.locator(".preloader_wrap")).toHaveCount(0);
  await expectRevealed(page);
  await expectNavVisible(page);
});

test("returning home through the transition cover reveals the nav", async ({
  page,
}) => {
  await skipPreloader(page);
  // `pt:cover` is what an inbound navigation leaves behind; arriving with it
  // set is the third way the reveal promise resolves.
  await seedSession(page, { "pt:cover": "1" });
  await page.goto("/");

  await expectRevealed(page);
  await expectNavVisible(page);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("pt:cover")))
    .toBeNull();
});

for (const path of ["/work", "/about", "/archive"]) {
  test(`direct load of ${path} reveals with no hold classes left`, async ({
    page,
  }) => {
    await skipPreloader(page);
    await page.goto(path);
    await expectRevealed(page);
  });
}

test("a project page reveals and keeps its nav", async ({ page }) => {
  await skipPreloader(page);
  await page.goto("/work/money-me");
  await expectRevealed(page);
  await expect.poll(() => rootClasses(page)).toContain("page-work-project");
});

/**
 * Grain is a 200% overlay with an infinite step animation. Below the compact
 * nav cut (`width < 48rem`) it is `display: none` and the texture is not
 * preloaded — the phone layout must not paint it, and everything above that
 * cut still must.
 */
test("grain is off on the phone layout and on above it", async ({ page }) => {
  await skipPreloader(page);
  await page.goto("/");
  await expectRevealed(page);

  const display = await page
    .locator(".site-grain")
    .evaluate((el) => getComputedStyle(el).display);

  if (isNarrowNav()) {
    expect(display).toBe("none");
  } else {
    expect(display).not.toBe("none");
  }
});

/**
 * Same headings, same `top 80%` ScrollTrigger, same SplitText lines. On the
 * phone layout the melt is a clip-up of `.gooey_reveal_inner` from
 * `yPercent: 110`; above that cut it is still the gooey.
 */
test("phone headings clip up from below on the heading scroll trigger", async ({
  page,
  context,
}) => {
  test.skip(!isNarrowNav(), "clip-up replaces the melt only below 48rem");

  await skipPreloader(page);
  await page.goto("/");
  await expectRevealed(page);

  const parked = () =>
    page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".manifesto_lead");
      if (!el) return { ok: false, reason: "no manifesto lead" };
      const inners = [
        ...el.querySelectorAll<HTMLElement>(".gooey_reveal_inner"),
      ];
      if (!inners.length) return { ok: false, reason: "no split inners" };
      const yOf = (node: HTMLElement) => {
        const t = getComputedStyle(node).transform;
        if (!t || t === "none") return 0;
        return new DOMMatrix(t).f;
      };
      const parkedInners = inners.filter((inner) => {
        const height = inner.getBoundingClientRect().height;
        return height > 0 && yOf(inner) > height * 0.5;
      });
      return {
        ok: true,
        slide: el.classList.contains("gooey_reveal_slide"),
        gooey: el.classList.contains("gooey_reveal"),
        filter: getComputedStyle(inners[0]).filter,
        parked: parkedInners.length,
        total: inners.length,
      };
    });

  await expect.poll(parked).toMatchObject({
    ok: true,
    slide: true,
    gooey: false,
    parked: expect.any(Number),
  });
  const before = await parked();
  expect(before.filter === "none" || before.filter === "").toBe(true);
  expect(before.parked).toBeGreaterThan(0);

  const cdp = await context.newCDPSession(page);
  await scrollDown(page, cdp, isTouch());

  await expect
    .poll(async () => {
      const after = await parked();
      return after.ok && after.parked === 0;
    })
    .toBe(true);
});
