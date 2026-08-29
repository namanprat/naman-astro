import { expect, test } from "@playwright/test";
import { expectRevealed, skipPreloader, stubWebGL } from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubWebGL(page);
  await skipPreloader(page);
});

test("home keeps the logo-then-nav lockup and overlays glass by z-index", async ({
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

  expect(order[0]).toBe("name_hero");
  expect(order[1]).toBe("nav_wrap");
  expect(order).not.toContain("hero_glass");
  expect(order).not.toContain("hero_chrome_pad");

  await expect(page.locator("a.name_hero_home")).toHaveCount(0);
  await expect(page.locator("div.name_hero_home")).toHaveCount(1);

  await expect(page.locator(".hero_glass")).toBeVisible();
  await expect(page.locator(".name_hero")).toBeVisible();
  await expect(page.locator(".nav_wrap")).toBeVisible();

  const stack = await page.evaluate(() => {
    const z = (sel: string) =>
      Number.parseInt(getComputedStyle(document.querySelector(sel)!).zIndex, 10);
    return {
      logo: z(".name_hero"),
      glass: z(".hero_glass"),
      nav: z(".nav_wrap"),
    };
  });

  expect(stack.glass).toBeGreaterThan(stack.logo);
  expect(stack.nav).toBeGreaterThan(stack.glass);
});

test("inner pages do not mount the hero glass overlay", async ({ page }) => {
  await page.goto("/work");
  await expectRevealed(page);
  await expect(page.locator(".hero_glass")).toHaveCount(0);
});
