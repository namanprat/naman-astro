import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import {
  expectRevealed,
  rootClasses,
  skipPreloader,
  stubWebGL,
} from "./helpers";

/**
 * Things that were only broken at phone and tablet widths, and so were invisible
 * to a suite that asserted "the page came up".
 *
 * Each of these failed silently: no error, no blank page, just a feature quietly
 * absent or a filter quietly stuck on.
 */

test.describe("the footer ASCII wordmark", () => {
  test.skip(
    () => test.info().project.name === "reduced-motion",
    "reduced motion falls back to the plain SVG on purpose",
  );

  /**
   * Regression: the canvas was gated behind the same desktop media query as the
   * pointer interaction, so phones and tablets fell back to the SVG and the
   * lockup never painted at all.
   */
  test("paints cells at this width", async ({ page }) => {
    await stubWebGL(page);
    await skipPreloader(page);
    await page.goto("/");
    await expectRevealed(page);

    const canvas = page.locator(".footer-ascii__canvas");
    await canvas.scrollIntoViewIfNeeded();

    // Ink coverage, not just a sized canvas: an empty grid still has dimensions.
    await expect
      .poll(
        () =>
          canvas.evaluate((el) => {
            const c = el as HTMLCanvasElement;
            const ctx = c.getContext("2d");
            if (!ctx || !c.width || !c.height) return 0;
            const { data } = ctx.getImageData(0, 0, c.width, c.height);
            let lit = 0;
            for (let i = 3; i < data.length; i += 4) {
              if (data[i] > 8) lit++;
            }
            return lit;
          }),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(500);
  });

  test("the SVG it samples stays hidden behind the canvas", async ({
    page,
  }) => {
    await stubWebGL(page);
    await skipPreloader(page);
    await page.goto("/");
    await expectRevealed(page);

    // Both visible at once would double the wordmark.
    await expect(page.locator(".footer-logo__source")).toHaveCSS(
      "visibility",
      "hidden",
    );
  });
});

/**
 * `/archive/IMG_4294.webm` is VP9, which Safari has no decoder for. The field is
 * all-or-nothing off one array and the batch was `Promise.all`, so that single
 * rejection emptied it: every iOS visitor got the grid, the centre label, and
 * none of the hundred tiles. Two independent guards went in, so each gets its
 * own test — either alone is enough to keep the orb populated.
 */
test.describe("the archive poster field", () => {
  test("reaches for the H.264 sibling when the webm will not decode", async ({
    page,
  }) => {
    const asked: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("IMG_4294")) asked.push(request.url());
    });

    await skipPreloader(page);
    await page.route("**/archive/*.webm", (route) => route.abort());
    await page.goto("/archive");
    await expect.poll(() => rootClasses(page)).toContain("page-archive");

    await expect
      .poll(() => asked.some((url) => url.endsWith(".mp4")), {
        timeout: 30_000,
      })
      .toBe(true);
  });

  /**
   * With every encoding of the clip gone there is nothing to fall back to, which
   * is the case `allSettled` exists for: the ten posters that did load still
   * have to fill the orb.
   *
   * Measured off a screenshot rather than the canvas: the field is WebGL and the
   * context is created without `preserveDrawingBuffer`, so reading its pixels
   * back inside the page returns an empty buffer. A screenshot goes through the
   * compositor and sees what the visitor sees.
   *
   * Calibrated at 390x844 — a populated field covers ~0.35 of the sampled band,
   * an empty one ~0.02 — so the threshold sits nowhere near either state.
   */
  test("still fills when a source fails outright", async ({ page }) => {
    await skipPreloader(page);
    await page.route("**/archive/IMG_4294.*", (route) => route.abort());
    await page.goto("/archive");
    await expect.poll(() => rootClasses(page)).toContain("page-archive");
    await expect(page.locator(".archive-stage canvas")).toBeVisible();

    await expect
      .poll(() => litBandFraction(page), { timeout: 60_000 })
      .toBeGreaterThan(0.15);
  });
});

/**
 * Fraction of the middle half of the viewport that is not near-black.
 *
 * Banded to exclude the chrome — the wordmark, the MENU pill and the view
 * switcher are all lit regardless of whether a single poster loaded.
 */
async function litBandFraction(page: Page): Promise<number> {
  const { width, height } = page.viewportSize()!;
  const png = await page.screenshot({
    clip: {
      x: 0,
      y: Math.round(height * 0.25),
      width,
      height: Math.round(height * 0.5),
    },
  });

  const { data } = await sharp(png)
    .resize(120, 120, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let lit = 0;
  for (let i = 0; i < data.length; i += 3) {
    if (data[i]! + data[i + 1]! + data[i + 2]! > 120) lit++;
  }
  return lit / (data.length / 3);
}

test.describe("the About panel lead", () => {
  /**
   * Regression: the lead's gooey was parked on every run of the open effect but
   * revealed only on the closed-to-open edge. `Menu` changes the panel's mode
   * while it is open whenever the viewport crosses 64rem, so a resize re-blurred
   * copy that had already settled with nothing left to clear it — and the lead
   * stayed blurred until the panel was closed and reopened.
   */
  test("does not re-blur when a resize changes the panel mode", async ({
    page,
  }) => {
    await stubWebGL(page);
    await skipPreloader(page);
    await page.goto("/");
    await expectRevealed(page);

    await page.evaluate(() => {
      window.location.hash = "#about";
    });
    await expect
      .poll(() => rootClasses(page), { timeout: 30_000 })
      .toContain("about-open");

    const lead = page.locator(".about-panel__lead");
    await expect(lead).toBeVisible();

    const blur = () =>
      lead.evaluate((el) =>
        [...el.querySelectorAll<HTMLElement>(".gooey-reveal__inner")].map(
          (inner) => inner.style.getPropertyValue("--gooey-blur") || "0px",
        ),
      );

    // Let the entrance land, so anything left over afterwards is a regression.
    await expect
      .poll(() => blur().then((v) => v.every((b) => parseFloat(b) === 0)), {
        timeout: 30_000,
      })
      .toBe(true);

    // Cross the nav breakpoint in both directions — `Menu` retargets the mode
    // each way, and each retarget re-ran the effect that used to re-park.
    const { width, height } = page.viewportSize()!;
    const across = width >= 1024 ? 800 : 1280;
    await page.setViewportSize({ width: across, height });
    await page.waitForTimeout(600);
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(600);

    expect(
      (await blur()).every((b) => parseFloat(b) === 0),
      "the About lead is still carrying a parked blur",
    ).toBe(true);
  });
});
