import { expect, test } from "@playwright/test";
import {
  expectNavVisible,
  expectRevealed,
  isNarrowNav,
  isTouch,
  rootClasses,
  scrollDown,
  seedTheme,
  skipPreloader,
  stubWebGL,
} from "./helpers";

/** Home's in-page section jumps and the About panel, which lives on every route. */
test.beforeEach(async ({ page }) => {
  await stubWebGL(page);
  await skipPreloader(page);
});

test("the homepage scrolls", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);

  await page.goto("/");
  await expectRevealed(page);

  // A real finger drag on the touch projects: the homepage runs Lenis over the
  // document scroller, and wheel and touch reach it by different routes.
  await scrollDown(page, cdp, isTouch());
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 30_000 })
    .toBeGreaterThan(0);
});

/**
 * Scroll the homepage with this device's own input, then get back to the top
 * through whichever surface the width actually offers.
 *
 * Home lives on the dedicated stack link above 48rem and on the nav logo
 * below it — the SVG lockup scrolls away with the hero at every width now, so
 * it is not a surface a scrolled page can offer. Both ends land in
 * `goTo("/")`, which does not navigate when already on `/`: it replays the
 * hero entrance and scrolls to the top, which is the path that regressed.
 */
test("returning Home scrolls to the top and keeps the nav up", async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  const narrow = isNarrowNav();

  await page.goto("/");
  await expectRevealed(page);

  await scrollDown(page, cdp, isTouch());
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 30_000 })
    .toBeGreaterThan(0);

  if (narrow) {
    await page.locator('.nav_logo a[href="/"]').first().click();
  } else {
    await page.locator('.nav_stack a[href="/"]').first().click();
  }

  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 30_000 })
    .toBe(0);
  await expect
    .poll(() => rootClasses(page), { timeout: 30_000 })
    .not.toContain("menu-open");
  await expectNavVisible(page);
});

test("About opens and closes without stranding its state", async ({ page }) => {
  /* Below 48rem About is its own route — there is no overlay to strand, so the
     equivalent guarantee is that the hash routes there and Back returns. */
  test.skip(
    isNarrowNav(),
    "About is a route at this width — see the /about navigation test",
  );

  await page.goto("/");
  await expectRevealed(page);

  await page.evaluate(() => {
    window.location.hash = "#about";
  });
  await expect.poll(() => rootClasses(page)).toContain("about-open");

  await page.keyboard.press("Escape");
  // Driven by the panel's `open` prop rather than the exit animation, so an
  // interrupted close cannot leave it behind. `WorkGallery` mutes the gallery's
  // wheel while it is set.
  await expect
    .poll(() => rootClasses(page), { timeout: 30_000 })
    .not.toContain("about-open");
});

test("desktop About docks the nav under the card", async ({ page }) => {
  test.skip(
    isNarrowNav(),
    "About is a route at this width — there is no overlay to dock onto",
  );

  await page.goto("/");
  await expectRevealed(page);

  await page.evaluate(() => {
    window.location.hash = "#about";
  });
  await expect.poll(() => rootClasses(page)).toContain("about-open");

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const nav = document.querySelector<HTMLElement>(".nav_wrap");
        const surface = document.querySelector<HTMLElement>(
          ".about_panel_surface",
        );
        if (!nav || !surface) return "missing";
        const navTop = nav.getBoundingClientRect().top;
        const cardBottom = surface.getBoundingClientRect().bottom;
        /* Docked: the bar's top sits on the orange edge, not above the card
           in the hero. A few pixels of subpixel / padding slack. */
        if (navTop < 80) return `still at top ${Math.round(navTop)}`;
        if (Math.abs(navTop - cardBottom) > 8) {
          return `gap ${Math.round(navTop - cardBottom)}`;
        }
        return "ok";
      });
    }, { timeout: 15_000 })
    .toBe("ok");
});

test("opening About on desktop locks scroll behind the overlay", async ({
  page,
}) => {
  test.skip(
    isNarrowNav(),
    "About is a route at this width — the document is meant to scroll",
  );

  await page.goto("/");
  await expectRevealed(page);

  await page.evaluate(() => {
    window.location.hash = "#about";
  });
  await expect.poll(() => rootClasses(page)).toContain("about-open");

  const overflow = await page.evaluate(
    () => getComputedStyle(document.documentElement).overflow,
  );
  expect(overflow).toBe("hidden");

  const y0 = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 1200);
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBe(y0);
});

/**
 * Opening the Contact dropdown must not move the rest of the nav.
 *
 * Row 2 is `repeat(4, max-content)` under `justify-content: space-between`, so
 * a track that narrows hands its width back to the gaps and shifts every item.
 * The toggle swaps "Contact" (7 chars) for "Close" (5), which is the only
 * label in the bar that changes width — Work/"Back" and About/"Close" are both
 * same-length. `.nav_contact_toggle h5` is pinned to `7ch` to hold it.
 */
test("opening Contact does not reflow the mobile nav row", async ({ page }) => {
  test.skip(!isNarrowNav(), "the two-row nav only exists below 48rem");

  await page.goto("/");
  await expectRevealed(page);

  const rowX = () =>
    page.evaluate(() =>
      [".nav_work", ".nav_archive", ".nav_contact", ".nav_about"].map((s) =>
        Math.round(document.querySelector(s)!.getBoundingClientRect().x),
      ),
    );

  const before = await rowX();
  const toggle = page.locator(".nav_contact_toggle").first();
  await toggle.click();
  /* Not the label text: `RollingText` doubles every glyph for the hover roll,
     so it reads "CClloossee". `aria-expanded` is the state itself. */
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  expect(await rowX(), "row shifted while Contact was open").toEqual(before);
});

/**
 * The phone counterpart to the overlay test above.
 *
 * Below 48rem About is a document: the nav link routes to it, the ASCII bust
 * that the card had no room for is laid out, and the footer is present. The
 * overlay must NOT also mount there — `Menu` renders it on every route, so a
 * second hidden copy of the whole panel (duplicate `id` included) is the
 * regression this guards.
 */
test("About is a real page below the nav breakpoint", async ({ page }) => {
  test.skip(!isNarrowNav(), "About is an overlay at this width");

  await page.goto("/");
  await expectRevealed(page);

  await page.locator(".nav_about").first().click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/about");
  await expectRevealed(page);

  await expect(page.locator(".about_panel.is-page")).toBeVisible();
  await expect(page.locator(".about_panel")).toHaveCount(1);
  await expect(page.locator(".about_panel_media")).toBeVisible();
  await expect(page.locator(".footer_wrap")).toHaveCount(1);
  // The lockup is a home-page element now.
  await expect(page.locator(".name_hero")).toBeHidden();
});

/**
 * Phone About sits on `.grid.is-12`, not a nested 1-col stack or a pixel
 * inset measured off the nav. 4-col (< 30rem): Clients spans 1–4 with names
 * on tracks 1 and 3; Services follows on 1–2. 6-col: they sit side by side.
 */
test("phone About lists sit on the site grid tracks", async ({ page }) => {
  test.skip(!isNarrowNav(), "About is an overlay at this width");

  await page.goto("/about");
  await expectRevealed(page);

  const geometry = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(".about_panel_grid");
    const services = document.querySelector<HTMLElement>(
      ".about_panel_col.is-services",
    );
    const clients = document.querySelector<HTMLElement>(
      ".about_panel_col.is-clients",
    );
    const clientCols = [
      ...document.querySelectorAll<HTMLElement>(
        ".about_panel_clients_cols > .about_panel_col_list",
      ),
    ];
    if (!grid || !services || !clients || clientCols.length < 2) return null;

    const cs = getComputedStyle(grid);
    const widths = cs.gridTemplateColumns
      .split(" ")
      .map((value) => parseFloat(value));
    const gap = parseFloat(cs.columnGap) || 0;
    const origin = grid.getBoundingClientRect().left;
    const trackStart = (index: number) => {
      let x = origin;
      for (let i = 0; i < index; i += 1) x += widths[i] + gap;
      return x;
    };

    return {
      cols: widths.length,
      listsDisplay: getComputedStyle(
        document.querySelector(".about_panel_lists")!,
      ).display,
      servicesLeft: services.getBoundingClientRect().left,
      clientsLeft: clients.getBoundingClientRect().left,
      clientCol0: clientCols[0].getBoundingClientRect().left,
      clientCol1: clientCols[1].getBoundingClientRect().left,
      track1: trackStart(0),
      track3: trackStart(2),
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry!.listsDisplay).toBe("contents");
  expect(geometry!.cols).toBeGreaterThanOrEqual(4);
  expect(geometry!.servicesLeft).toBeCloseTo(geometry!.track1, 1);
  expect(geometry!.clientsLeft).toBeCloseTo(geometry!.track1, 1);
  expect(geometry!.clientCol0).toBeCloseTo(geometry!.track1, 1);
  expect(geometry!.clientCol1).toBeCloseTo(geometry!.track3, 1);
});

/**
 * The About lead has to fill its column, not shrink-to-fit it.
 *
 * `.about_panel_intro` is a column flex box with `align-items: flex-start` and
 * a `display: contents` wrapper, so the heading is itself a flex item. Without
 * an explicit width its size is intrinsic, and WebKit folds the
 * `overflow-wrap: break-word` that `base.css` puts on every heading into its
 * min-content calculation — collapsing the lead to one word per line. It then
 * stays collapsed, because `prepareGooey` splits the heading with SplitText on
 * open and bakes the wrap points into real `.gooey_reveal_line` divs.
 *
 * Blink resolves the same shrink-to-fit to the full column, so this cannot
 * reproduce the Safari rendering. What it can do is lock the geometry the bug
 * needs: an intrinsic width here would be a regression on WebKit whether or
 * not Chromium shows it.
 */
test("the About lead fills its column rather than sizing to its text", async ({
  page,
}) => {
  /* Same lead, same column rule — only how you reach it differs by width. */
  if (isNarrowNav()) {
    await page.goto("/about");
    await expectRevealed(page);
  } else {
    await page.goto("/");
    await expectRevealed(page);
    await page.evaluate(() => {
      window.location.hash = "#about";
    });
    await expect.poll(() => rootClasses(page)).toContain("about-open");
  }

  const lead = page.locator(".about_panel_lead");
  await expect(lead).toBeVisible();

  const geometry = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".about_panel_lead");
    const column = el?.closest<HTMLElement>(".about_panel_intro");
    if (!el || !column) return null;
    return {
      lead: el.getBoundingClientRect().width,
      column: column.getBoundingClientRect().width,
      words: (el.textContent ?? "").trim().split(/\s+/).length,
      // Zero before the split runs; the reveal bakes one div per line.
      lines: el.querySelectorAll(".gooey_reveal_line").length,
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry!.lead).toBeCloseTo(geometry!.column, 0);
  // The collapse puts every word on its own line, so anything near the word
  // count is the failure this guards.
  if (geometry!.lines > 0) {
    expect(geometry!.lines).toBeLessThan(geometry!.words / 2);
  }
});

/**
 * Every frosted surface must ship a `backdrop-filter` this engine understands.
 *
 * The stylesheets used to hand-write `-webkit-backdrop-filter` after the
 * unprefixed property. Lightning CSS merges that pair into one property, and
 * with no `build.cssTarget` the last declaration won outright — so the build
 * shipped the `-webkit-` form alone. Safari honours it; Chromium dropped the
 * alias and Firefox never had it, so the frost silently computed to `none` in
 * both and every card read as a flat tint.
 *
 * Nothing about that is visible in the source, which is why it is asserted
 * against the *built* CSS through a real browser rather than by grepping.
 */
test("the frosted surfaces actually carry a backdrop filter", async ({
  page,
}) => {
  // Light mode is where the frost exists at all: dark turns it off and fills
  // the same surfaces with opaque orange.
  await seedTheme(page, "light");

  const narrow = isNarrowNav();

  if (narrow) {
    await page.goto("/about");
    await expectRevealed(page);
  } else {
    await page.goto("/");
    await expectRevealed(page);
    await page.evaluate(() => {
      window.location.hash = "#about";
    });
    await expect.poll(() => rootClasses(page)).toContain("about-open");
  }

  /* Below 48rem About is a route, not a card, so its surface is deliberately
     unfrosted — it would read as a box floating over the document. The footer
     on that same page still carries the frost, so the built-CSS regression
     this test exists for is still covered here. */
  const frosted = narrow
    ? [".footer_child"]
    : [".about_panel_surface", ".footer_child", ".menu_overlay"];

  const frost = await page.evaluate(
    (selectors) =>
      selectors
        .map((selector) => {
          const el = document.querySelector(selector);
          return {
            selector,
            value: el ? getComputedStyle(el).backdropFilter : "ABSENT",
          };
        })
        .filter((entry) => entry.value !== "ABSENT"),
    frosted,
  );

  expect(frost.length).toBeGreaterThan(0);
  for (const { selector, value } of frost) {
    expect(value, `${selector} backdrop-filter`).toMatch(/blur\(\d/);
  }

  if (narrow) {
    const aboutSurface = await page.evaluate(() => {
      const el = document.querySelector(".about_panel_surface");
      return el ? getComputedStyle(el).backdropFilter : "ABSENT";
    });
    expect(aboutSurface, "the /about route must not be frosted").toBe("none");
  }
});

/**
 * iPhone Safari chrome (status bar / home indicator) follows the page theme
 * via `theme-color`. Archive is always the dark bar. Never the accent.
 */
test("theme-color follows the page theme so Safari chrome can match it", async ({
  page,
}) => {
  await seedTheme(page, "dark");
  await page.goto("/");
  await expectRevealed(page);

  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#101010",
  );

  await page.locator(".nav_wrap .nav_theme_toggle").first().click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#e2e2dd",
  );
});

test("archive theme-color stays dark regardless of the stored theme", async ({
  page,
}) => {
  await seedTheme(page, "light");
  await page.goto("/archive");
  await expect(page.locator("html")).toHaveClass(/page-archive/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#101010",
  );

  await page.locator(".nav_wrap .nav_theme_toggle").first().click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#101010",
  );
});
