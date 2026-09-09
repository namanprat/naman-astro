import { expect, test } from "@playwright/test";
import { expectRevealed, skipPreloader, stubWebGL } from "./helpers";

test.describe("process cards", () => {
  test.beforeEach(async ({ page }) => {
    await stubWebGL(page);
    await skipPreloader(page);
  });

  test("process cards each request a distinct GLB", async ({ page }) => {
    const models = new Set<string>();
    page.on("request", (req) => {
      const match = /\/models\/([123]\.glb)(?:\?|$)/.exec(req.url());
      if (match) models.add(match[1]);
    });

    await page.goto("/");
    await expectRevealed(page);

    await page.locator("#process").scrollIntoViewIfNeeded();
    await expect(page.locator(".process_card")).toHaveCount(3);
    await expect
      .poll(() => [...models].sort().join(","), { timeout: 30_000 })
      .toBe("1.glb,2.glb,3.glb");
    await expect(page.locator("[data-process-model]")).toHaveCount(3);
    await expect(page.locator('[data-process-model="1"]')).toHaveCount(1);
    await expect(page.locator('[data-process-model="2"]')).toHaveCount(1);
    await expect(page.locator('[data-process-model="3"]')).toHaveCount(1);
  });

  test("process model gui mounts with ?process-gui", async ({ page }) => {
    await page.goto("/?process-gui");
    await expectRevealed(page);
    await page.locator("#process").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-process-model]")).toHaveCount(3);
    await expect(
      page.locator(".lil-gui").filter({ hasText: "Process models" }),
    ).toBeVisible({ timeout: 20_000 });
    const panel = page
      .locator(".lil-gui")
      .filter({ hasText: "Process models" });
    await panel.locator(":scope > .title").click();
    await expect(panel.getByText("1 · rock")).toBeVisible();
    await expect(panel.getByText("2 · flower")).toBeVisible();
    await expect(panel.getByText("3 · bolt")).toBeVisible();
  });
});

test("home preloader fetches the process GLBs", async ({ page }) => {
  await stubWebGL(page);
  const models = new Set<string>();
  page.on("request", (req) => {
    const match = /\/models\/([123]\.glb)(?:\?|$)/.exec(req.url());
    if (match) models.add(match[1]);
  });

  await page.goto("/");
  await expect
    .poll(() => [...models].sort().join(","), { timeout: 30_000 })
    .toBe("1.glb,2.glb,3.glb");
  await expect(page.locator("[data-preload-cta]")).toBeVisible();
});
