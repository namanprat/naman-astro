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
 * The machine's software renderer is enough for both tests below, and the
 * second is the reason: the sim parks itself, so this no longer costs a
 * sustained 47 full-screen passes a frame to observe.
 */
/* One project per question, not five: running unstubbed software WebGL
   everywhere at once is the CPU starvation `playwright.config.ts` already
   halves the worker count for — it surfaces as unrelated entrance animations
   timing out in other files, not as a failure here. Desktop answers "does the
   sim run and settle"; phone answers "is it gone", which is a different answer
   rather than the same one at another width. */
const DESKTOP_ONLY = () => test.info().project.name !== "desktop";
const PHONE_ONLY = () => test.info().project.name !== "phone";

test.beforeEach(async ({ page }) => {
  await skipPreloader(page);
});


test("the fluid backdrop mounts on home", async ({ page }) => {
  test.skip(DESKTOP_ONLY(), "covered once, on desktop");

  await page.goto("/");
  await expectRevealed(page);

  await expect(page.locator(".fluid_wrap canvas")).toBeAttached();
});

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
  test.skip(DESKTOP_ONLY(), "covered once, on desktop");

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

/**
 * Below 48rem there is no cursor to trail — a touch drag emits `pointermove`,
 * so the liquid only ever followed the scroll — and a fluid sim is 47
 * full-screen GPU passes per simulated frame to pay for it. `FluidCanvas`
 * builds neither the sim nor the plane that paints it there, and on the routes
 * that have nothing else to draw it mounts no WebGL context at all.
 *
 * Home is the exception and has to stay one: the phone hero draws its mark in
 * this same canvas, so an over-eager gate would take the wordmark with it.
 */
test.describe("the phone drops the trail", () => {
  test.skip(PHONE_ONLY, "this is the phone layout's answer");


  for (const path of ["/work", "/work/haptic", "/about"]) {
    test(`no fluid context on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectRevealed(page);

      await expect(page.locator(".fluid_wrap")).toBeAttached();
      await expect(page.locator(".fluid_wrap canvas")).toHaveCount(0);
    });
  }

  test("home keeps its canvas — the mark is drawn in it", async ({ page }) => {
    await page.goto("/");
    await expectRevealed(page);

    await expect(page.locator(".fluid_wrap canvas")).toBeAttached();
  });
});
