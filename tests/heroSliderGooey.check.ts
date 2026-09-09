/**
 * Featured slider copy must go through gooeyReveal — no one-off melt class,
 * no slider-local filter/shadow on the title.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const astro = readFileSync(
  new URL("../src/components/site/HeroSlider.astro", import.meta.url),
  "utf8",
);
/**
 * The slider's stylesheet, which now lives in the component's own <style>
 * block rather than a sibling .css.
 *
 * ponytail: the style body is extracted rather than asserting against the
 * whole file. Every CSS assertion below is a `doesNotMatch` — no text-shadow,
 * no filter chain, no `cursor: none` — and run against the whole component
 * those would also read the markup and the script, where `filter:` could
 * appear legitimately and fail the check for the wrong reason.
 */
const css = [...astro.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1])
  .join("\n");
assert.ok(css.length > 0, "slider must carry its styles in a <style> block");
const ts = readFileSync(
  new URL("../src/components/site/HeroSlider.ts", import.meta.url),
  "utf8",
);

assert.match(
  astro,
  /class="hero_slider_title text-style-h1"/,
  "title host is unmarked — parkGooey / revealClass() own the melt class",
);
assert.match(
  astro,
  /class="hero_slider_kicker text-style-small"/,
  "kicker host is unmarked — parkGooey / revealClass() own the melt class",
);
assert.doesNotMatch(
  astro,
  /class="hero_slider_title(?!_inner)[^"]*gooey_reveal/,
  "title must not hardcode gooey_reveal",
);
assert.doesNotMatch(
  astro,
  /class="hero_slider_kicker(?!_inner)[^"]*gooey_reveal/,
  "kicker must not hardcode gooey_reveal",
);
assert.match(
  astro,
  /hero_slider_title_inner gooey_reveal_inner/,
  "title inner is the shared gooey_reveal_inner",
);
assert.match(
  astro,
  /hero_slider_kicker_inner gooey_reveal_inner/,
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

assert.doesNotMatch(
  astro,
  /hero_slider_view_label|View project<\/span/,
  "desktop slider must not paint a View project control",
);
assert.match(
  astro,
  /hero_slider_cursor/,
  "photo hover uses the view cursor chip",
);
assert.doesNotMatch(
  css,
  /cursor:\s*none/,
  "view chip trails the pointer — do not hide the system cursor",
);
assert.match(ts, /quickTo/, "view chip lerps behind the pointer");

console.log("heroSliderGooey: all assertions passed");
