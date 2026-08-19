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
 * No nav line is still parked below its mask.
 *
 * `heroIntro` hides the nav by pushing each line to `yPercent: 110` inside an
 * `overflow: hidden` parent, so a parked nav is not off-screen and not
 * transparent — it is simply clipped out of a box that is still exactly where
 * it belongs. Comparing against the viewport would pass either way; the line
 * has to be checked against the box that clips it.
 *
 * Widths below the 64rem nav breakpoint hide the link stack entirely and leave
 * only the wordmark, so unrendered lines are skipped rather than failed — but
 * at least one line has to be there, or the check is vacuous.
 */
export async function expectNavVisible(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const lines = [
            ...document.querySelectorAll<HTMLElement>(
              ".nav_grid .nav-stack > .nav-link h5, .nav_grid .nav-logo-wordmark h5",
            ),
          ];
          const rendered = lines.filter(
            (line) => line.getBoundingClientRect().height > 0,
          );
          if (!rendered.length) return "no nav line is rendered";

          const parked = rendered.filter((line) => {
            const mask = line.parentElement;
            if (!mask) return false;
            const box = line.getBoundingClientRect();
            const clip = mask.getBoundingClientRect();
            // A 1px slack keeps sub-pixel layout from reading as parked.
            return box.top >= clip.bottom - 1;
          });
          return parked.length ? `${parked.length} nav line(s) parked` : "ok";
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
  if (touch) {
    await touchDrag(cdp, page);
  } else {
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 700);
  }
  await page.waitForTimeout(1200);
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
