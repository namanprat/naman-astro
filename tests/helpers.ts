import { expect, test, type CDPSession, type Page } from "@playwright/test";

/** Classes that hold content hidden until an entrance module releases them. */
const HOLD_CLASSES = ["is-preloading", "is-line-revealing", "is-gooey-arming"];

/* Read off `test.info()` rather than taking a `TestInfo` argument: Playwright
   hands a conditional `test.skip()` callback the fixtures only, so a helper
   that needed TestInfo could not be used to gate a whole describe block. */
export function isTouch(): boolean {
  const name = test.info().project.name;
  return name === "tablet" || name === "phone";
}

/** True below the `(width >= 48rem)` nav breakpoint (Menu.tsx's DESKTOP_NAV_MQ),
 *  where WORK has no BACK state. */
export function isNarrowNav(): boolean {
  return (test.info().project.use.viewport?.width ?? 0) < 768;
}

/**
 * Take the full-screen fluid simulation out of the frame budget.
 *
 * On a machine with no GPU the sim runs through software WebGL and drags the
 * whole rAF loop down to about 2 frames a second. That is a property of the
 * renderer, not of the site — but at 2fps the gallery's own settle can complete
 * *between* two touch-move frames and pull the drag back to where it started,
 * so every timing-sensitive assertion here would be measuring the container.
 *
 * Scoped by parent — `.fluid_wrap` for the sim, `.hero_glass` for the frosted
 * hero — rather than refused outright: the homepage's team carousel and the
 * archive are three.js too, and taking every WebGL context away takes those
 * islands down with it, after which the homepage never mounts and has nothing
 * to scroll.
 *
 * The hero is here for the same 2fps reason, twice over: its transmission
 * material renders the whole scene into an FBO on every frame, on top of the
 * sim. `HeroGlassCanvas` probes for a context before it mounts anything and
 * leaves the DOM lockup painting when there is none, so refusing it here is a
 * supported path rather than a crash — which is also what a visitor with no
 * WebGL2 gets.
 *
 * Set `E2E_WEBGL=1` to run against the real canvases where a GPU is available.
 */
export async function stubWebGL(page: Page) {
  if (process.env.E2E_WEBGL === "1") return;
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (
        String(type).includes("webgl") &&
        (this.closest(".fluid_wrap") || this.closest(".hero_glass"))
      ) {
        return null;
      }
      return (original as never as (...args: unknown[]) => unknown).call(
        this,
        type,
        ...rest,
      );
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

/**
 * Pin the colour theme before `BaseLayout`'s pre-paint script reads it.
 *
 * Pages set their own default — the homepage is `theme="dark"` — and the two
 * themes are not cosmetic variants of one surface: dark mode turns the frost
 * off outright (`--surface-frost-blur: 0rem`, opaque orange fills), so
 * anything asserting on the frost has to say which theme it means.
 */
export async function seedTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem("site-theme", value);
    } catch {}
  }, theme);
}

/** Pre-set the session keys a test wants, before any script on the page runs. */
export async function seedSession(page: Page, entries: Record<string, string>) {
  await page.addInitScript((values) => {
    try {
      for (const [key, value] of Object.entries(values)) {
        sessionStorage.setItem(key, value);
      }
    } catch {
      // private mode — the test just exercises the cold path instead
    }
  }, entries);
}

/** Skip the once-per-session home preloader. */
export const skipPreloader = (page: Page) =>
  seedSession(page, { "preload:seen": "1" });

export const rootClasses = (page: Page) =>
  page.evaluate(() => document.documentElement.className.split(/\s+/));

/**
 * The page is visible and nothing is still holding copy hidden.
 *
 * `is-revealed` is what `heroIntro` waits on before it unparks the nav on the
 * first load of a tab. Later navigations leave the nav unparked. The two hold
 * classes keep every heading and paragraph at `visibility: hidden` until their
 * modules boot. All three come off the same `bootIfCovered()` promise, so a
 * page that never resolves it stays blank with no error anywhere — the failure
 * this suite exists to catch.
 */
export async function expectRevealed(page: Page) {
  await expect
    .poll(() => rootClasses(page), { timeout: 30_000 })
    .toContain("is-revealed");
  for (const held of HOLD_CLASSES) {
    await expect
      .poll(() => rootClasses(page), { timeout: 30_000 })
      .not.toContain(held);
  }
}

/**
 * Nothing `heroIntro` parks is still parked.
 *
 * It hides two different things, and which one is on screen depends entirely on
 * the width — so checking either alone passes vacuously on the other half of
 * the matrix:
 *
 * - The nav lines, pushed to `yPercent: 110` inside an `overflow: clip`
 *   parent. A parked line is neither off-screen nor transparent, just clipped
 *   out of a box that is still exactly where it belongs, so it has to be
 *   compared against the box that clips it rather than against the viewport.
 * - The hero lockup, held at `visibility: hidden` by
 *   `.name_hero_gooey:not(.is-gooey-parked)` until the melt is armed.
 *
 * Below the 48rem nav breakpoint the homepage still paints the SVG lockup;
 * the wordmark link also sits in the first nav column. Unrendered lines are
 * skipped rather than failed. Requiring at least one of the two signals is
 * what stops the check passing on a page where neither exists.
 */
export async function expectNavVisible(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const rendered = [
            ...document.querySelectorAll<HTMLElement>(
              ".nav_grid .nav_stack > .nav_link h5, .nav_grid .nav_logo_wordmark h5",
            ),
          ].filter((line) => line.getBoundingClientRect().height > 0);

          const parked = rendered.filter((line) => {
            const mask = line.parentElement;
            if (!mask) return false;
            const box = line.getBoundingClientRect();
            const clip = mask.getBoundingClientRect();
            // A 1px slack keeps sub-pixel layout from reading as parked.
            return box.top >= clip.bottom - 1;
          });
          if (parked.length) return `${parked.length} nav line(s) parked`;

          const lockup =
            document.querySelector<HTMLElement>(".name_hero_gooey");
          const lockupPainted =
            !!lockup &&
            lockup.getBoundingClientRect().height > 0 &&
            getComputedStyle(lockup).visibility !== "hidden";

          if (!rendered.length && !lockupPainted) {
            return lockup
              ? "the hero lockup is still hidden and no nav line is rendered"
              : "no nav line is rendered";
          }
          return "ok";
        }),
      { timeout: 30_000 },
    )
    .toBe("ok");
}

/**
 * Tile centres, for the signed drift metric below.
 *
 * Deliberately *not* shared with `tilePositions`, which reads the top-left
 * corner. Folding the two into one geometry read looks like tidying and is
 * not: the corner and the centre disagree whenever a tile's box scales rather
 * than translates, and the reverse Flip on the return-from-project path does
 * exactly that. Rewriting `tilePositions` in terms of centres made
 * `galleryMoves` report "nothing moved" there, and that test went from passing
 * six times out of six to failing six out of six.
 */
const tileCentres = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".gallery_slide")].map((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }),
  );

/** Position of every gallery tile — the whole set, so a wrapped loop still reads as movement. */
export const tilePositions = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".gallery_slide")].map((el) => {
      const box = el.getBoundingClientRect();
      return `${Math.round(box.x)},${Math.round(box.y)}`;
    }),
  );

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Which way the gallery moved under one gesture, as a signed scalar.
 *
 * The two views need different scalars because they move on different axes:
 * the grid translates vertically, the ring rotates about the viewport centre.
 * Both are *medians*, not means. The grid's loop can wrap a tile by the full
 * loop height mid-gesture and the ring's angles wrap at ±180°, and in either
 * case one outlier would drag a mean past zero and flip the sign this exists
 * to report.
 *
 * The number has no unit and is only ever compared against another reading
 * from the same view — its sign is the whole point.
 */
export async function galleryDrift(
  page: Page,
  cdp: CDPSession,
  touch: boolean,
  view: "grid" | "slider",
): Promise<number> {
  const before = await tileCentres(page);
  await scrollDown(page, cdp, touch);
  const after = await tileCentres(page);
  if (before.length !== after.length || !before.length) return 0;

  const { width, height } = page.viewportSize()!;

  if (view === "grid") {
    return median(after.map((box, i) => box.y - before[i].y));
  }

  const angle = (p: { x: number; y: number }) =>
    Math.atan2(p.y - height / 2, p.x - width / 2);
  return median(
    after.map((box, i) => {
      const delta = angle(box) - angle(before[i]);
      // Shortest way round, so a tile crossing the seam is not read as a
      // near-full turn in the opposite direction.
      return Math.atan2(Math.sin(delta), Math.cos(delta));
    }),
  );
}

/** A downward scroll gesture in whatever form this device actually sends. */
export async function scrollDown(page: Page, cdp: CDPSession, touch: boolean) {
  if (touch) {
    await touchDrag(cdp, page);
  } else {
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 700);
  }
  await page.waitForTimeout(1200);
}

async function touchDrag(cdp: CDPSession, page: Page) {
  const { width, height } = page.viewportSize()!;
  const x = Math.round(width / 2);
  const from = Math.round(height * 0.8);
  const distance = Math.round(height * 0.5);

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: from }],
  });
  for (let step = 1; step <= 12; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: from - (distance * step) / 12 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

/**
 * Drive the gallery the way the device would, and report whether it moved.
 *
 * `html.page-work` sets `touch-action: none` and there is no document scroller,
 * so a GSAP `Observer` is the only scroll input on `/work`. If the engine's
 * Observer is left disabled — or `engineEnabled()` is poisoned by a class that
 * outlived its animation — the page looks completely normal and simply stops
 * responding, which is exactly what a screenshot cannot catch.
 */
export async function galleryMoves(
  page: Page,
  cdp: CDPSession,
  touch: boolean,
): Promise<boolean> {
  const before = await tilePositions(page);
  await scrollDown(page, cdp, touch);
  const after = await tilePositions(page);
  return before.join("|") !== after.join("|");
}

/** Open the tile nearest the viewport centre, so a scrolled gallery still hits one. */
export async function openNearestProject(page: Page) {
  const point = await page.evaluate(() => {
    const midX = window.innerWidth / 2;
    const midY = window.innerHeight / 2;
    let best: { x: number; y: number; d: number } | null = null;
    for (const el of document.querySelectorAll<HTMLElement>(".gallery_slide")) {
      const box = el.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight)
        continue;
      const d = Math.hypot(x - midX, y - midY);
      if (!best || d < best.d) best = { x, y, d };
    }
    return best;
  });

  expect(point, "no gallery tile inside the viewport to open").not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
  await expect
    .poll(() => rootClasses(page), { timeout: 30_000 })
    .toContain("work-project-open");
  // The URL is published by the open timeline's onComplete, not on click.
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toMatch(/^\/work\/[^/]+$/);
}

/** Wait for the overlay to be fully closed and the address to agree with it. */
export async function expectGalleryRestored(page: Page) {
  await expect
    .poll(() => rootClasses(page), { timeout: 30_000 })
    .not.toContain("work-project-open");
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
    .toBe("/work");
}
