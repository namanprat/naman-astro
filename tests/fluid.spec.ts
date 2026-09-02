import { expect, test, type Page } from "@playwright/test";
import { expectRevealed, skipPreloader } from "./helpers";

/**
 * The one file in the suite that does *not* call `stubWebGL`.
 *
 * Everywhere else the fluid context is refused so the sim is out of the frame
 * budget. Here the canvas is the subject, and refusing the context is a
 * supported path that mounts nothing at all — so under the stub there is no
 * backdrop to assert on. This file used to pass anyway, because the work-grid
 * drain plate was a `<canvas>` mounted on every route and `.fluid_wrap canvas`
 * matched that instead of the backdrop.
 *
 * The machine's software renderer is enough for the tests below, and parking is
 * the reason: the sim parks itself, so this no longer costs a sustained 47
 * full-screen passes a frame to observe.
 */

/** Draw calls and animation frames since the probe was installed. */
const PROBE = () => {
  window.__draws = 0;
  window.__frames = 0;

  const counted = <T extends (...args: never[]) => unknown>(original: T): T =>
    function (this: unknown, ...args: never[]) {
      window.__draws++;
      return original.apply(this, args);
    } as T;

  /* Both interfaces get these two off `WebGLRenderingContextBase`, which is
     also the only part of either this needs to name. */
  const protos: WebGLRenderingContextBase[] = [];
  if (window.WebGLRenderingContext) {
    protos.push(window.WebGLRenderingContext.prototype);
  }
  if (window.WebGL2RenderingContext) {
    protos.push(window.WebGL2RenderingContext.prototype);
  }
  for (const proto of protos) {
    proto.drawArrays = counted(proto.drawArrays);
    proto.drawElements = counted(proto.drawElements);
  }

  const tick = () => {
    window.__frames++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const read = (page: Page) =>
  page.evaluate(() => ({
    draws: window.__draws,
    frames: window.__frames,
  }));

test.describe("desktop fluid backdrop", () => {
  /* One project is enough for mount + settle. Running unstubbed software WebGL
     on all five at once is the CPU starvation `playwright.config.ts` already
     halves the worker count for. */
  test.skip(
    () => test.info().project.name !== "desktop",
    "covered once, on desktop",
  );

  test.beforeEach(async ({ page }) => {
    await skipPreloader(page);
  });

  test("the fluid backdrop mounts on home", async ({ page }) => {
    await page.goto("/");
    await expectRevealed(page);

    await expect(page.locator(".fluid_wrap canvas")).toBeAttached();
  });

  /**
   * `/work` rather than home: it has no hero, so the backdrop is the only thing
   * drawing and the count is the sim's alone. Home's glass renders the scene into
   * a transmission buffer every frame whatever the sim is doing.
   *
   * Every full-screen pass is one `drawElements` on the sim's shared quad, so
   * draws-per-frame is a direct read of the pass budget. A simulated frame is 47
   * of them; the settled steady state is one scene draw. Counting per frame
   * rather than per second is what makes the threshold hold on a machine with no
   * GPU, where the frame rate is whatever the software renderer manages.
   */
  test("the backdrop stops drawing once the trail has settled", async ({
    page,
  }) => {
    await page.addInitScript(PROBE);
    await page.goto("/work");
    await expectRevealed(page);

    // Past the sim's settle window, with margin. No pointer input in between, so
    // nothing has woken it.
    await page.waitForTimeout(8000);

    const start = await read(page);
    await page.waitForTimeout(3000);
    const end = await read(page);

    const frames = end.frames - start.frames;
    const draws = end.draws - start.draws;
    expect(frames, "no frames sampled, so the budget below means nothing")
      .toBeGreaterThan(10);
    expect(
      draws / frames,
      `${draws} draws over ${frames} frames — the sim is still simulating`,
    ).toBeLessThan(5);
  });
});

/**
 * Touch-primary: pointer moves must not re-wake the sim after settle.
 * Covered on tablet (above the phone layout cut, with coarse pointer).
 */
test.describe("touch-primary trail gate", () => {
  test.skip(
    () => test.info().project.name !== "tablet",
    "iPad-class: desktop width + touch",
  );

  test.beforeEach(async ({ page }) => {
    await skipPreloader(page);
  });

  test("pointer moves do not keep the backdrop simulating", async ({
    page,
    context,
  }) => {
    await page.addInitScript(PROBE);
    await page.goto("/work");
    await expectRevealed(page);
    await page.waitForTimeout(8000);

    /* Real touch points — `page.mouse` is pointerType mouse and would only
       prove the media-query half of the gate. */
    const cdp = await context.newCDPSession(page);
    const { width, height } = page.viewportSize()!;
    const x = Math.round(width / 2);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: Math.round(height * 0.2) }],
    });
    for (let i = 1; i <= 20; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: Math.round(height * (0.2 + (0.6 * i) / 20)) }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    const start = await read(page);
    await page.waitForTimeout(2000);
    const end = await read(page);

    const frames = end.frames - start.frames;
    const draws = end.draws - start.draws;
    expect(frames).toBeGreaterThan(10);
    expect(
      draws / frames,
      `${draws} draws over ${frames} frames after touch moves — trail still live`,
    ).toBeLessThan(5);
  });
});
