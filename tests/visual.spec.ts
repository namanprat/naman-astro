/**
 * Visual baselines for the Lumos CSS migration.
 *
 * The rest of the suite asserts behaviour — that the gallery moves, that the
 * preloader hands over, that no hold class outlives its module. None of it can
 * see layout, which is exactly what rewriting class names, tokens and the
 * cascade layers puts at risk. These shots are the safety net for that work.
 *
 * Every `<canvas>` is masked. The fluid sim, team carousel, archive orb, About
 * bust and the ASCII footer logo all paint per-frame from a clock or a
 * pointer, so they never produce the same pixels twice; comparing them would
 * fail on noise and hide real layout drift.
 */
import { expect, test, type Page } from "@playwright/test";
import { expectRevealed, skipPreloader, stubWebGL } from "./helpers";

/** Canvases paint per-frame; compare the layout around them, not their pixels. */
const MASK = (page: Page) => [page.locator("canvas")];

const SHOT = {
  animations: "disabled",
  caret: "hide",
  // Sub-pixel text rendering differs by a hair between runs on the same
  // machine; a small ratio keeps that from reading as a layout change.
  maxDiffPixelRatio: 0.01,
} as const;

async function open(page: Page, path: string) {
  await stubWebGL(page);
  await skipPreloader(page);
  await page.goto(path);
  await expectRevealed(page);
  // Entrance tweens are driven by the GSAP ticker, which `animations: disabled`
  // does not freeze — it only pauses CSS/Web animations.
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.waitForTimeout(2500);
}

/* Document-scrolling pages: the whole page is worth comparing. */
for (const [name, path] of [
  ["home", "/"],
  ["project", "/work/haptic"],
] as const) {
  test(`${name} matches its baseline`, async ({ page }) => {
    await open(page, path);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      ...SHOT,
      fullPage: true,
      mask: MASK(page),
    });
  });
}

/* Viewport-locked pages: `html.page-work` / `.page-archive` kill document
   scroll, so a full-page shot is just the viewport with extra steps. */
for (const [name, path] of [
  ["work", "/work"],
  ["archive", "/archive"],
] as const) {
  test(`${name} matches its baseline`, async ({ page }) => {
    await open(page, path);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      ...SHOT,
      mask: MASK(page),
    });
  });
}

test("the menu overlay matches its baseline", async ({ page }) => {
  await open(page, "/");
  await page.getByRole("button", { name: /menu/i }).first().click();
  await page.waitForTimeout(2000);
  await expect(page).toHaveScreenshot("menu.png", {
    ...SHOT,
    mask: MASK(page),
  });
});
