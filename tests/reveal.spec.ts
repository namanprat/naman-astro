import { expect, test } from "@playwright/test";
import {
  expectNavVisible,
  expectRevealed,
  isNarrowNav,
  rootClasses,
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

  await expect(page.locator(".preloader_wrap")).toHaveCount(0, {
    timeout: 90_000,
  });
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
 * The heading entrance runs one of two ways, and which one is a width decision
 * `gooeyReveal.ts` makes at park time: the melt above the 48rem cutoff, a
 * mask-clipped slide below it. Both share the split, the `top 80%` trigger and
 * the settle, so the only thing worth pinning is that each viewport parks in
 * its own mode and that both land clean — no marker class, no filter, no
 * transform, nothing left clipped.
 *
 * Reduced motion is exempt: nothing splits there, so there is no mode to check.
 */
test("headings park in this width's mode and settle clean", async ({
  page,
}) => {
  test.skip(
    test.info().project.name === "reduced-motion",
    "no entrance runs, so no mode is chosen",
  );

  await skipPreloader(page);
  await page.goto("/");
  await expectRevealed(page);

  // Well below the fold on every project, so it is still parked on arrival.
  const head = page.locator(".team_title");
  const read = () =>
    head.evaluate((el) => {
      const inner = el.querySelector<HTMLElement>(".gooey_reveal_inner");
      const line = inner?.closest<HTMLElement>(".gooey_reveal_line") ?? null;
      return {
        cls: el.className,
        filter: inner ? getComputedStyle(inner).filter : "",
        transform: inner ? getComputedStyle(inner).transform : "",
        lineOverflow: line ? getComputedStyle(line).overflow : "",
      };
    });

  await expect
    .poll(async () => (await read()).cls)
    .toMatch(isNarrowNav() ? /gooey_reveal_slide/ : /gooey_reveal(_soft)?\b/);

  const parked = await read();
  if (isNarrowNav()) {
    // Held below its own clip, with no filter of either kind in the chain.
    expect(parked.transform).not.toBe("none");
    expect(parked.filter).toBe("none");
    expect(parked.lineOverflow).toBe("clip");
  } else {
    expect(parked.filter).toContain("blur(");
    expect(parked.filter).not.toContain("blur(0px)");
    expect(parked.transform).toBe("none");
  }

  /* Read down a screen at a time rather than jumping straight to the heading.
     ScrollTrigger caches each start as a scroll offset, and this page is still
     growing when the triggers are built — the team canvas and the footer's
     scaled block both settle late — so a single jump can land past a start that
     has since moved and never cross it. A reader's own descent crosses it
     wherever it ended up, in either mode. */
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(150);
        return (await read()).cls;
      },
      { timeout: 30_000 },
    )
    .not.toMatch(/gooey_reveal/);
  const settled = await read();
  expect(settled.filter).toBe("none");
  expect(settled.transform).toBe("none");
  expect(settled.lineOverflow).toBe("visible");
});
