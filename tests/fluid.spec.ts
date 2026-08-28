import { expect, test } from "@playwright/test";
import {
  expectRevealed,
  isNarrowNav,
  skipPreloader,
  stubWebGL,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubWebGL(page);
  await skipPreloader(page);
});

test("studio intersection dims the fluid on desktop, not on phone", async ({
  page,
}) => {
  await page.goto("/");
  await expectRevealed(page);

  const studio = page.locator(".studio");
  await studio.scrollIntoViewIfNeeded();
  await expect(studio).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.classList.contains("is-hero-fluid-dim"),
      ),
    )
    .toBe(!isNarrowNav());
});
