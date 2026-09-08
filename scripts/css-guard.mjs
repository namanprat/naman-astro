#!/usr/bin/env node
/**
 * Fail if a migrated stylesheet grows back the conventions we just killed.
 *
 * The oversized sheets — Work, AboutPanel, Menu — used to sit off this list
 * because each carried grid-column `@media` blocks. They are split now, and the
 * split is what let them on: the named parts are breakpointless and listed
 * here, while every genuine breakpoint block moved into one quarantine sheet
 * per family. Those quarantine files are the deliberate exemptions, named in
 * `EXEMPT` below so a reader can see the whole of what is not covered.
 */
import { readFileSync } from "node:fs";

const files = [
  "src/components/site/Faq.astro",
  "src/components/site/Process.astro",
  "src/components/site/Manifesto.astro",
  "src/components/site/CamilleSlider.astro",
  "src/components/site/Team.astro",
  "src/components/site/AnimeLink.astro",
  "src/lib/site/reveal/rollingText.css",
  "src/components/ViewSwitcher.css",
  "src/styles/patterns.css",
  "src/components/site/FluidCanvas.css",
  "src/components/site/Preloader.astro",
  "src/pages/404.astro",
  "src/components/work/WorkRoute.css",
  "src/components/work/WorkGallery.css",
  "src/components/work/WorkProject.css",
];

/**
 * Sheets deliberately off the list, and what each one holds. Checked for
 * existence rather than for content: an exemption that has been renamed or
 * deleted is an exemption nobody re-argued, and the point of naming them is
 * that "what is not covered" has one answer in one place.
 */
const EXEMPT = {
  "src/components/work/WorkBreakpoints.css": "Work family breakpoints",
};

const bans = [
  { name: "@media width breakpoint", re: /@media[^{]*width/ },
  { name: "legacy alias var(--ink|--accent|--dark|--white|--black)", re: /var\(--(ink|accent|dark|white|black)\)/ },
  { name: "BEM __ class", re: /\.[a-z]+__[a-z]/ },
  { name: "overflow: hidden", re: /overflow:\s*hidden/, scrub: dropRootScrollLocks },
  { name: "bare 1fr", re: /(?<!minmax\(0,\s*)1fr/, scrub: dropRowTracks },
];

/**
 * Drop `overflow: hidden` where the subject is the document, not a box.
 *
 * ponytail: the ban is aimed at component boxes, where `clip` is the right
 * answer — it clips without making a scroll container, so a stray wheel event
 * cannot move content that has no scrollbar. A route lock is the opposite
 * case: `html.page-work` and `html.menu-open` want a real scroll container
 * that simply cannot be scrolled by the reader, because GSAP and Lenis still
 * scroll it programmatically, and `clip` would take that away too. `site.css`
 * has carried the same pair of rules since before this guard existed.
 *
 * Selector-aware rather than a per-file allowance: the exemption then lapses
 * the moment the rule stops being a document lock, which a file-level opt-out
 * would not.
 */
function dropRootScrollLocks(css) {
  /* Every selector in the list has to end on `html` or `body`, so the subject
     is the document and not something inside it: `html.page-work .nav_wrap`
     is a box like any other and stays banned. */
  const isDocumentSubject = (prelude) =>
    prelude.split(",").every((selector) => {
      const subject = selector.trim().split(/[\s>+~]+/).filter(Boolean).pop();
      return /^(html|body)\b/.test(subject ?? "");
    });

  return css.replace(
    /([{}])([^{}]*)\{([^{}]*)\}/g,
    (whole, open, prelude, body) =>
      isDocumentSubject(prelude)
        ? `${open}${prelude}{${body.replace(/overflow:\s*hidden/g, "")}}`
        : whole,
  );
}

/**
 * Drop `1fr` from row-track declarations.
 *
 * ponytail: the ban exists because a bare `1fr` column track has a min-width
 * of `auto`, so one long word inside it pushes the whole grid wider than its
 * container — `minmax(0, 1fr)` is what stops that. Rows have no such failure
 * mode: a row track's min is its content height, and a grid does not overflow
 * vertically the way it overflows horizontally. `grid-template-rows: auto 1fr`
 * is the correct spelling, and `minmax(0, 1fr)` there would let a row collapse
 * under its content instead.
 */
function dropRowTracks(css) {
  return css.replace(/grid-(template|auto)-rows:[^;}]*/g, "");
}

/**
 * The CSS a ban should actually read: `<style>` bodies for `.astro`, the whole
 * file for `.css`, with block comments stripped from both.
 *
 * ponytail: the stripping is not tidiness, it is correctness. `@media[^{]*width`
 * spans newlines and stops only at a `{`, so a comment that mentions `@media`
 * and later the word "width" — which is exactly how this codebase explains why
 * a rule uses `--_responsive---*` instead of a breakpoint — matched as a
 * breakpoint. `Preloader.astro` failed on that, with no `@media` in it but
 * `prefers-reduced-motion`. Narrowing `.astro` to its `<style>` bodies is the
 * same argument one level up: `width="20"` on an inline SVG is not CSS.
 */
function styleSource(file, src) {
  const css = file.endsWith(".astro")
    ? [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")
    : src;
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Sub-layer each component sheet must declare, from styles/global.css:
 *   site < chrome < section < page
 *
 * ponytail: this is a structural check, not a style one, and it is here because
 * the cascade now leans on it. Work.css and Archive.css restyle Menu-owned
 * nodes at identical specificity, so which one wins is decided purely by layer
 * — and a sheet that quietly reverts to a bare `@layer components` rejoins the
 * order-dependent behaviour this replaced, with nothing visible to say so until
 * a nav bar lands in the wrong place on one route at one width.
 */
const LAYERS = ["site", "chrome", "section", "page"];

/**
 * The Lumos backbone. These carry no `@layer` of their own because
 * `styles/global.css` imports each one into its layer with `layer(...)`, so a
 * declaration inside the file would be a second, conflicting answer.
 */
const BACKBONE = new Set([
  "src/styles/base.css",
  "src/styles/patterns.css",
  "src/styles/utilities.css",
]);

/**
 * Deliberately unlayered scoped styles.
 *
 * ponytail: an Astro `<style>` is unlayered unless it says otherwise, and
 * unlayered beats every layer. These two want that — they are whole-page
 * surfaces that sit above the site's own chrome — but a converted component
 * never does, because its rules would silently outrank the `components` layer
 * they used to live in. So the layer requirement covers `.astro` too, and this
 * is the short list of files allowed to opt out.
 */
const UNLAYERED = new Set([
  "src/components/site/Preloader.astro",
  "src/pages/404.astro",
]);
const layerOpener = new RegExp(`@layer components\\.(${LAYERS.join("|")})\\s*\\{`);

let failed = 0;
for (const file of files) {
  const src = styleSource(file, readFileSync(file, "utf8"));
  if (!BACKBONE.has(file) && !UNLAYERED.has(file) && !layerOpener.test(src)) {
    const found = src.match(/@layer[^{]*\{/);
    console.error(
      `${file}: must open with @layer components.<${LAYERS.join("|")}> ` +
        `(found ${found ? found[0].trim() : "no @layer"})`,
    );
    failed++;
  }
  for (const { name, re, scrub } of bans) {
    if (re.test(scrub ? scrub(src) : src)) {
      console.error(`${file}: ${name}`);
      failed++;
    }
  }
}

for (const [file, holds] of Object.entries(EXEMPT)) {
  try {
    readFileSync(file, "utf8");
  } catch {
    console.error(`${file}: named exempt (${holds}) but missing`);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed} convention regression(s).`);
  process.exit(1);
}
console.log(
  `css-guard: ${files.length} files clean, ` +
    `${Object.keys(EXEMPT).length} named exempt.`,
);
