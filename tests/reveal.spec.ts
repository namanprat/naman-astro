import { expect, test } from "@playwright/test";
import {
  expectNavVisible,
  expectRevealed,
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

test("cold session: the preloader hands over and the nav appears", async ({
  page,
}) => {
  // No seeding: this is the once-per-session path, keyed on `preload:seen`.
  await page.goto("/");

  const cta = page.locator("[data-preload-cta]");
  await expect(cta).toHaveAttribute("data-ready", "1", { timeout: 60_000 });
  await cta.click();

  await expectRevealed(page);
  await expectNavVisible(page);
});

test("second visit in the same session skips the preloader and still reveals", async ({
  page,
}) => {
  await skipPreloader(page);
  await page.goto("/");

  await expect(page.locator(".preloader")).toHaveCount(0);
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
