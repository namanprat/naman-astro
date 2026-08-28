import { expect, test } from "@playwright/test";
import { expectRevealed, skipPreloader, stubWebGL } from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubWebGL(page);
  await skipPreloader(page);
});

test("the hero glass slot sits between the nav and the wordmark", async ({
  page,
}) => {
  await page.goto("/");
  await expectRevealed(page);

  const order = await page.evaluate(() => {
    const chrome = document.querySelector(".hero_chrome");
    if (!chrome) return [];
    return [...chrome.children].map((el) =>
      (el as HTMLElement).className.split(/\s+/)[0],
    );
  });

  const nav = order.indexOf("nav_wrap");
  const model = order.indexOf("hero_model");
  const logo = order.indexOf("name_hero");
  expect(nav).toBeGreaterThanOrEqual(0);
  expect(model).toBeGreaterThan(nav);
  expect(logo).toBeGreaterThan(model);

  await expect(page.locator(".hero_model")).toBeVisible();
});

test("inner pages do not mount the hero glass slot", async ({ page }) => {
  await page.goto("/work");
  await expectRevealed(page);
  await expect(page.locator(".hero_model")).toHaveCount(0);
});
