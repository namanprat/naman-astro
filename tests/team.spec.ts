import { expect, test } from "@playwright/test";
import { expectRevealed, skipPreloader, stubWebGL } from "./helpers";

/**
 * Team closer: the cylinder fills the section, title sits at the top, body
 * at the bottom. A merge dropped the stage CSS, so the canvas collapsed to
 * 0×0 and the two copy blocks stacked on top of each other in the centre.
 */
test.beforeEach(async ({ page }) => {
  await stubWebGL(page);
  await skipPreloader(page);
});

test("team cylinder fills the section and copy does not overlap", async ({
  page,
}) => {
  await page.goto("/");
  await expectRevealed(page);

  const section = page.locator("#team");
  await section.scrollIntoViewIfNeeded();
  await expect(section).toBeVisible();

  const title = page.locator(".team_title");
  const body = page.locator(".team_copy_stack");
  await expect(title).toBeVisible();
  await expect(body).toBeVisible();

  await expect
    .poll(async () => {
      const sectionBox = await section.boundingBox();
      const titleBox = await title.boundingBox();
      const bodyBox = await body.boundingBox();
      if (!sectionBox || !titleBox || !bodyBox) return "missing boxes";
      const overlap =
        titleBox.y + titleBox.height > bodyBox.y + 1 &&
        bodyBox.y + bodyBox.height > titleBox.y + 1;
      if (overlap) return "title overlaps body";
      if (titleBox.y >= bodyBox.y) return "title is not above body";
      return "ok";
    })
    .toBe("ok");

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const wrap = document.getElementById("team");
        const stage = document.querySelector<HTMLElement>(".team_stage");
        if (!wrap || !stage) return { ok: false as const, reason: "no stage" };
        const wrapBox = wrap.getBoundingClientRect();
        const stageBox = stage.getBoundingClientRect();
        const w = Math.round(stageBox.width);
        const h = Math.round(stageBox.height);
        if (w < wrapBox.width * 0.9 || h < wrapBox.height * 0.9) {
          return { ok: false as const, reason: `stage ${w}x${h}` };
        }
        const canvas = stage.querySelector("canvas");
        if (!canvas) return { ok: false as const, reason: "no canvas" };
        const canvasBox = canvas.getBoundingClientRect();
        if (canvasBox.width < 200 || canvasBox.height < 200) {
          return {
            ok: false as const,
            reason: `canvas ${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}`,
          };
        }
        return { ok: true as const, canvas: "ready" };
      });
    })
    .toEqual({ ok: true, canvas: "ready" });
});
