import { expect, test, type Page } from "@playwright/test";
import { expectRevealed, skipPreloader, stubWebGL } from "./helpers";

/**
 * Team closer: the cylinder fills the section behind the centred lockup.
 * Title and body stack over the ring and must not overlap.
 *
 * `.team_title` is below the fold, so `bootGooeyHeadings` parks it until the
 * heading's ScrollTrigger. On the phone clip-up that park is `yPercent: 110`,
 * which inflates the heading box into the body until settle — wait for the
 * reveal classes to drop before measuring.
 */
test.beforeEach(async ({ page }) => {
  await stubWebGL(page);
  await skipPreloader(page);
});

async function expectTeamTitleSettled(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector<HTMLElement>(".team_title");
          if (!el) return "no title";
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return "ok";
          }
          const revealing =
            el.classList.contains("gooey_reveal") ||
            el.classList.contains("gooey_reveal_soft") ||
            el.classList.contains("gooey_reveal_slide");
          if (revealing) return "still revealing";
          return "ok";
        }),
      { timeout: 30_000 },
    )
    .toBe("ok");
}

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
  await expectTeamTitleSettled(page);

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
      const titleMid = titleBox.y + titleBox.height / 2;
      const wrapMid = sectionBox.y + sectionBox.height / 2;
      // Old lockup: headline sits in the wrap, not pinned to the top/bottom.
      if (Math.abs(titleMid - wrapMid) > sectionBox.height * 0.35) {
        return "title is not in the wrap";
      }
      return "ok";
    })
    .toBe("ok");

  await expect
    .poll(
      async () => {
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
      },
      { timeout: 30_000 },
    )
    .toEqual({ ok: true, canvas: "ready" });
});
