/**
 * Featured slider copy must go through gooeyReveal — no one-off melt class,
 * no slider-local filter/shadow on the title.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const astro = readFileSync(
  new URL("../src/components/site/CamilleSlider.astro", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../src/components/site/CamilleSlider.css", import.meta.url),
  "utf8",
);
const ts = readFileSync(
  new URL("../src/lib/site/camilleSlider.ts", import.meta.url),
  "utf8",
);

assert.match(
  astro,
  /class="camille_slider_title text-style-h2"/,
  "title host is unmarked — parkGooey / revealClass() own the melt class",
);
assert.match(
  astro,
  /class="camille_slider_kicker text-style-small"/,
  "kicker host is unmarked — parkGooey / revealClass() own the melt class",
);
assert.doesNotMatch(
  astro,
  /class="camille_slider_title(?!_inner)[^"]*gooey_reveal/,
  "title must not hardcode gooey_reveal",
);
assert.doesNotMatch(
  astro,
  /class="camille_slider_kicker(?!_inner)[^"]*gooey_reveal/,
  "kicker must not hardcode gooey_reveal",
);
assert.match(
  astro,
  /camille_slider_title_inner gooey_reveal_inner/,
  "title inner is the shared gooey_reveal_inner",
);
assert.match(
  astro,
  /camille_slider_kicker_inner gooey_reveal_inner/,
  "kicker inner is the shared gooey_reveal_inner",
);

assert.doesNotMatch(
  css,
  /text-shadow/,
  "slider CSS must not paint a custom shadow through the melt",
);
assert.doesNotMatch(
  css,
  /filter\s*:/,
  "slider CSS must not declare its own filter chain",
);
assert.doesNotMatch(
  css,
  /--gooey-blur/,
  "slider CSS must not re-author --gooey-blur",
);

for (const api of [
  "parkGooey",
  "armGooey",
  "addGooeyReveal",
  "gooeyMorph",
  "REVEAL_START",
]) {
  assert.match(ts, new RegExp(api), `slider drives copy through ${api}`);
}

console.log("camilleGooey: all assertions passed");
