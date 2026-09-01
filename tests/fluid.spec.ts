import { expect, test } from "@playwright/test";
import { expectRevealed, skipPreloader, stubWebGL } from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubWebGL(page);
  await skipPreloader(page);
});

/* The studio-intersection dim this file used to assert is gone: the trail holds
   one weight the whole way down the page now, so there is no class to poll. What
   is left worth checking is that the backdrop mounts at all — it is the surface
   the hero glass renders into as well.

   The wrap, not a canvas inside it: `stubWebGL` refuses every context under
   `.fluid_wrap`, so the sim deliberately mounts nothing there and the assertion
   was only ever satisfied by whichever other canvas happened to be parked in
   the wrap. The wrap is the island's own root and nothing server-renders it, so
   its presence is the mount. */
test("the fluid backdrop mounts on home", async ({ page }) => {
  await page.goto("/");
  await expectRevealed(page);

  await expect(page.locator(".fluid_wrap")).toBeAttached();
});
