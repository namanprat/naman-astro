import { expect, test } from "@playwright/test";
import {
  expectNavVisible,
  expectRevealed,
  isNarrowNav,
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

/**
 * The slowest test here by a wide margin, and none of it is the site's doing.
 *
 * It is the only one that cannot skip the preloader, so it waits on the real
 * asset load, and then on a 0.9s exit that is frame-*count* bound rather than
 * time bound: GSAP's default lag smoothing advances a tween by at most 33ms per
 * tick, so the exit needs ~27 frames however long each one takes. Headless
 * Chromium here throttles rAF hard unless something is already driving frames —
 * measured, the same exit runs in 1.0s at 59fps with a rAF loop present and
 * ~15s without one. On a real browser with a compositor it is 0.9s.
 *
 * So the budget is sized for the environment, not for the animation.
 */
test("cold session: the preloader hands over and the nav appears", async ({
  page,
}) => {
  test.setTimeout(240_000);

  // No seeding: this is the once-per-session path, keyed on `preload:seen`.
  await page.goto("/");

  const cta = page.locator("[data-preload-cta]");
  await expect(cta).toHaveAttribute("data-ready", "1", { timeout: 60_000 });
  await cta.click();

  await expect(page.locator(".preloader_wrap")).toHaveCount(0, {
    timeout: 90_000,
  });
  await expectRevealed(page);
  await expectNavVisible(page);
});

test("second visit in the same session skips the preloader and still reveals", async ({
  page,
}) => {
  await skipPreloader(page);
  await page.goto("/");

  await expect(page.locator(".preloader_wrap")).toHaveCount(0);
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

/**
 * Grain is a 200% overlay with an infinite step animation. Below the compact
 * nav cut (`width < 48rem`) it is `display: none` and the texture is not
 * preloaded — the phone layout must not paint it, and everything above that
 * cut still must.
 */
test("grain is off on the phone layout and on above it", async ({ page }) => {
  await skipPreloader(page);
  await page.goto("/");
  await expectRevealed(page);

  const display = await page
    .locator(".site-grain")
    .evaluate((el) => getComputedStyle(el).display);

  if (isNarrowNav()) {
    expect(display).toBe("none");
  } else {
    expect(display).not.toBe("none");
  }
});

/**
 * Same headings, same `top 80%` ScrollTrigger, same SplitText lines. On the
 * phone layout the melt is a clip-up of `.gooey_reveal_inner` from
 * `yPercent: 110`; above that cut it is still the gooey.
 *
 * `.team_title` is server-rendered (unlike Manifesto/Process/Faq islands), so
 * `bootGooeyHeadings` always sees it before the failsafe. It also sits well
 * below the fold, so the park is still in place on a fresh load.
 */
test("phone headings clip up from below on the heading scroll trigger", async ({
  page,
}) => {
  test.skip(!isNarrowNav(), "clip-up replaces the melt only below 48rem");

  await skipPreloader(page);
  await page.goto("/");
  await expectRevealed(page);

  const parked = () =>
    page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".team_title");
      if (!el) return { ok: false as const, reason: "no team title" };
      const inners = [
        ...el.querySelectorAll<HTMLElement>(".gooey_reveal_inner"),
      ];
      if (!inners.length) {
        return { ok: false as const, reason: "no split inners" };
      }
      const yOf = (node: HTMLElement) => {
        const t = getComputedStyle(node).transform;
        if (!t || t === "none") return 0;
        return new DOMMatrix(t).f;
      };
      const parkedInners = inners.filter((inner) => {
        const height = inner.getBoundingClientRect().height;
        return height > 0 && yOf(inner) > height * 0.5;
      });
      const line = el.querySelector(".gooey_reveal_line");
      return {
        ok: true as const,
        slide: el.classList.contains("gooey_reveal_slide"),
        gooey: el.classList.contains("gooey_reveal"),
        filter: getComputedStyle(inners[0]).filter,
        overflow: line ? getComputedStyle(line).overflow : "",
        parked: parkedInners.length,
        total: inners.length,
      };
    });

  await expect
    .poll(async () => {
      const state = await parked();
      if (!state.ok) return state.reason;
      if (!state.slide) return "not slide";
      if (state.gooey) return "still gooey";
      if (state.parked === 0) return "not parked";
      return "ok";
    })
    .toBe("ok");

  const before = await parked();
  if (!before.ok) throw new Error(before.reason);
  expect(before.filter === "none" || before.filter === "").toBe(true);
  expect(before.overflow).toMatch(/clip|hidden/);
});

/**
 * Featured-work titles used to hardcode `.gooey_reveal` and a local
 * `text-shadow`, which skipped `revealClass()` (soft / slide) and ran a
 * different melt than every other heading. They now park / arm / settle
 * through `gooeyReveal.ts` like Footer, and hops go through `gooeyMorph`.
 */
test("featured slider copy uses the shared gooey, not a custom chain", async ({
  page,
}) => {
  await skipPreloader(page);
  await page.goto("/");
  await expectRevealed(page);

  const title = page.locator(".camille_slider_title");
  await title.scrollIntoViewIfNeeded();

  const slide = isNarrowNav();

  const snapshot = () =>
    page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".camille_slider_title");
      const inner = document.querySelector<HTMLElement>(
        ".camille_slider_title_inner",
      );
      const kicker = document.querySelector<HTMLElement>(
        ".camille_slider_kicker",
      );
      if (!el || !inner || !kicker) return null;
      const official = [
        "gooey_reveal",
        "gooey_reveal_soft",
        "gooey_reveal_slide",
      ] as const;
      const hostUsed = official.filter((c) => el.classList.contains(c));
      const kickerUsed = official.filter((c) => kicker.classList.contains(c));
      return {
        reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        hostUsed,
        kickerUsed,
        inner: inner.className,
        filter: getComputedStyle(inner).filter,
        shadow: getComputedStyle(el).textShadow,
        text: (inner.textContent ?? "").trim(),
      };
    });

  await expect
    .poll(async () => {
      const s = await snapshot();
      if (!s) return "missing";
      if (!s.inner.includes("gooey_reveal_inner")) return "no inner";
      if (s.shadow !== "none" && s.shadow !== "") return `shadow ${s.shadow}`;
      if (s.hostUsed.length > 1) return `host ${s.hostUsed.join(",")}`;
      if (s.reduced) {
        return s.hostUsed.length === 0 ? "ok" : "armed under reduced motion";
      }
      if (slide) {
        if (s.hostUsed.includes("gooey_reveal")) return "melt on phone";
        return "ok";
      }
      if (s.hostUsed.includes("gooey_reveal_slide")) return "slide on desktop";
      return "ok";
    })
    .toBe("ok");

  const first = await snapshot();
  if (!first) throw new Error("missing slider title");

  await page.locator(".camille_slider_next").click();

  await expect
    .poll(async () => {
      const s = await snapshot();
      if (!s) return "missing";
      if (s.text === first.text) return "same title";
      if (s.shadow !== "none" && s.shadow !== "") return `shadow ${s.shadow}`;
      const filter = s.filter;
      if (filter.includes("url(") && !filter.includes("blur-matrix")) {
        return `custom url ${filter}`;
      }
      if (!s.reduced && !slide) {
        if (
          s.hostUsed.includes("gooey_reveal") &&
          !filter.includes("blur-matrix") &&
          !filter.includes("blur(")
        ) {
          return `armed without chain ${filter}`;
        }
      }
      if (!s.reduced && slide && s.hostUsed.includes("gooey_reveal")) {
        return "melt on phone after hop";
      }
      return "ok";
    })
    .toBe("ok");
});
