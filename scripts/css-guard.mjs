#!/usr/bin/env node
/**
 * Fail if a migrated stylesheet grows back the conventions we just killed.
 * Menu/Work/AboutPanel still carry grid-column @media, so they stay off this
 * list until those layout shifts can move onto responsive vars.
 */
import { readFileSync } from "node:fs";

const files = [
  "src/components/site/Faq.css",
  "src/components/site/Process.css",
  "src/components/site/Manifesto.css",
  "src/components/site/CamilleSlider.css",
  "src/components/site/Team.css",
  "src/components/site/AnimeLink.css",
  "src/components/site/RollingText.css",
  "src/components/ViewSwitcher.css",
  "src/styles/patterns.css",
  "src/components/site/FluidCanvas.css",
  "src/components/site/Preloader.astro",
  "src/pages/404.astro",
];

const bans = [
  { name: "@media width breakpoint", re: /@media[^{]*width/ },
  { name: "legacy alias var(--ink|--accent|--dark|--white|--black)", re: /var\(--(ink|accent|dark|white|black)\)/ },
  { name: "BEM __ class", re: /\.[a-z]+__[a-z]/ },
  { name: "overflow: hidden", re: /overflow:\s*hidden/ },
  { name: "bare 1fr", re: /(?<!minmax\(0,\s*)1fr/ },
];

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
const layerOpener = new RegExp(`@layer components\\.(${LAYERS.join("|")})\\s*\\{`);

let failed = 0;
for (const file of files) {
  const src = styleSource(file, readFileSync(file, "utf8"));
  // .astro sheets are scoped and unlayered by design, so only .css is checked.
  if (file.endsWith(".css") && !BACKBONE.has(file) && !layerOpener.test(src)) {
    const found = src.match(/@layer[^{]*\{/);
    console.error(
      `${file}: must open with @layer components.<${LAYERS.join("|")}> ` +
        `(found ${found ? found[0].trim() : "no @layer"})`,
    );
    failed++;
  }
  for (const { name, re } of bans) {
    if (re.test(src)) {
      console.error(`${file}: ${name}`);
      failed++;
    }
  }
}

if (failed) {
  console.error(`\n${failed} convention regression(s).`);
  process.exit(1);
}
console.log(`css-guard: ${files.length} files clean.`);
