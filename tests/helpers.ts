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

/** True below the `(width >= 64rem)` nav breakpoint, where WORK has no BACK state. */
export function isNarrowNav(): boolean {
  return (test.info().project.use.viewport?.width ?? 0) < 1024;
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
 * Scoped to the fluid canvas by its `.fluid-wrap` parent: the homepage's team
 * carousel and the archive are three.js too, and refusing every WebGL context
 * takes those islands down with it — the homepage then never mounts and has
 * nothing to scroll.
 *
 * Set `E2E_WEBGL=1` to run against the real canvas where a GPU is available.
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
      if (String(type).includes("webgl") && this.closest(".fluid-wrap")) {
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
 * `is-revealed` is what `heroIntro` waits on before it unparks the nav, and the
 * two hold classes are what keep every heading and paragraph at
 * `visibility: hidden` until their modules boot. All three come off the same
 * `bootIfCovered()` promise, so a page that never resolves it stays blank with
 * no error anywhere — the failure this suite exists to catch.
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
 * - The nav lines, pushed to `yPercent: 110` inside an `overflow: hidden`
 *   parent. A parked line is neither off-screen nor transparent, just clipped
 *   out of a box that is still exactly where it belongs, so it has to be
 *   compared against the box that clips it rather than against the viewport.
 * - The hero lockup, held at `visibility: hidden` by
 *   `.name-hero__gooey:not(.is-gooey-parked)` until the melt is armed.
 *
 * Below the 64rem nav breakpoint the homepage renders *no* nav text at all —
 * the link stack is hidden and the wordmark lives in the hero lockup — so
 * unrendered lines are skipped rather than failed, and the lockup carries the
 * assertion instead. Requiring at least one of the two signals is what stops
 * the check passing on a page where neither exists.
 */
export async function expectNavVisible(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const rendered = [
            ...document.querySelectorAll<HTMLElement>(
              ".nav_grid .nav-stack > .nav-link h5, .nav_grid .nav-logo-wordmark h5",
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
            document.querySelector<HTMLElement>(".name-hero__gooey");
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

/** Position of every gallery tile — the whole set, so a wrapped loop still reads as movement. */
export const tilePositions = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".gallery__slide")].map((el) => {
      const box = el.getBoundingClientRect();
      return `${Math.round(box.x)},${Math.round(box.y)}`;
    }),
  );

/** Settle time for the gallery's `power3.out` scrub, plus slack. */
const SETTLE_MS = 1200;

/** A downward scroll gesture in whatever form this device actually sends. */
export async function scrollDown(page: Page, cdp: CDPSession, touch: boolean) {
  if (touch) {
    const { height } = page.viewportSize()!;
    await swipe(page, cdp, -Math.round(height * 0.5));
  } else {
    await wheelBy(page, 700);
  }
  await page.waitForTimeout(SETTLE_MS);
}

/** Wheel `dy` px at the viewport centre. Positive is a scroll down. */
export async function wheelBy(page: Page, dy: number) {
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, dy);
}

/**
 * Drag a finger `dy` px from the viewport centre — negative for a swipe up,
 * which is the gesture that asks for a scroll *down*.
 *
 * Stepped rather than sent as one jump: Observer accumulates per move event and
 * debounces to a frame, so a single large move reads as one delta and misses the
 * momentum path entirely.
 */
export async function swipe(page: Page, cdp: CDPSession, dy: number) {
  const { width, height } = page.viewportSize()!;
  const x = Math.round(width / 2);
  // Start off-centre in the direction travelled from, so the whole gesture fits.
  const from = Math.round(dy < 0 ? height * 0.8 : height * 0.2);
  const steps = 12;

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: from }],
  });
  for (let step = 1; step <= steps; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: Math.round(from + (dy * step) / steps) }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

/** Gestures to spend looking for movement before giving up. */
const SHIFT_ATTEMPTS = 5;

/**
 * Wait until the tiles stop moving, rather than for a fixed settle.
 *
 * The scrub is a 0.75s `power3.out`, but on a machine with no GPU the whole rAF
 * loop runs slowly enough that a wall-clock wait can land mid-tween — which is
 * exactly why the suite runs at half occupancy. Two identical reads in a row is
 * the same signal without the guesswork.
 */
async function waitForGallerySettled(page: Page) {
  let previous = "";
  await expect
    .poll(
      async () => {
        const current = (await tilePositions(page)).join("|");
        const stable = current === previous;
        previous = current;
        return stable;
      },
      { intervals: [120], timeout: 15_000 },
    )
    .toBe(true);
}

/**
 * Where the first tile sits, in the coordinate its engine actually drives it in.
 *
 * The grid translates tiles down a vertical loop, so y is the whole story. The
 * ring orbits them about a centre, where y is not monotonic — it reverses twice a
 * revolution — so the ring reports the tile's angle about the ring instead. Both
 * come back as one signed number that advances with the engine.
 *
 * `.gallery__slide` includes the ring's clones, but only as extra samples for the
 * ring centre; the tracked tile is always the first one.
 */
const tileProgress = (page: Page, view: "slider" | "grid") =>
  page.evaluate((mode) => {
    const boxes = [
      ...document.querySelectorAll<HTMLElement>(".gallery__slide"),
    ].map((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    const first = boxes[0];
    if (!first) return null;
    if (mode === "grid") return first.y;

    const cx = boxes.reduce((sum, b) => sum + b.x, 0) / boxes.length;
    const cy = boxes.reduce((sum, b) => sum + b.y, 0) / boxes.length;
    return (Math.atan2(first.y - cy, first.x - cx) * 180) / Math.PI;
  }, view);

/** Signed difference, with the ring's degrees folded onto the short way round. */
function progressDelta(
  before: number,
  after: number,
  view: "slider" | "grid",
): number {
  const raw = after - before;
  if (view === "grid") return raw;
  return ((((raw + 180) % 360) + 360) % 360) - 180;
}

/**
 * Which way `gesture` drove the gallery, as a signed number.
 *
 * Repeated until something moves rather than sized to a distance that happens to
 * work: one gesture turns the ring several tiles and the grid a fraction of one,
 * and that ratio moves with the viewport. Stopping at the first movement also
 * keeps a ring reading well short of half a revolution, where its sign would stop
 * being meaningful.
 */
export async function gestureDirection(
  page: Page,
  view: "slider" | "grid",
  gesture: () => Promise<void>,
): Promise<number> {
  await waitForGallerySettled(page);
  const before = await tileProgress(page, view);
  if (before === null) return 0;

  for (let attempt = 0; attempt < SHIFT_ATTEMPTS; attempt++) {
    await gesture();
    await waitForGallerySettled(page);
    const after = await tileProgress(page, view);
    if (after === null) return 0;

    const delta = progressDelta(before, after, view);
    // Sub-pixel and sub-degree settle noise is not a direction.
    if (Math.abs(delta) > 1) return Math.sign(delta);
  }

  return 0;
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
    for (const el of document.querySelectorAll<HTMLElement>(
      ".gallery__slide",
    )) {
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
