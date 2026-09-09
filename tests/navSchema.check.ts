/**
 * Studio keeps page copy/images plus a dedicated marquee document.
 * Navigation chrome is not a CMS type — leftover `nav` fields must not return.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const singletons = readFileSync(
  join(root, "studio-duforn-portfolio/schemaTypes/singletons.ts"),
  "utf8",
);
const index = readFileSync(
  join(root, "studio-duforn-portfolio/schemaTypes/index.ts"),
  "utf8",
);
const structure = readFileSync(
  join(root, "studio-duforn-portfolio/structure.ts"),
  "utf8",
);
const constants = readFileSync(
  join(root, "studio-duforn-portfolio/schemaTypes/constants.ts"),
  "utf8",
);
const queries = readFileSync(join(root, "src/lib/sanity/queries.ts"), "utf8");

assert.match(singletons, /export const marqueeSettings/);
assert.doesNotMatch(singletons, /navSettings/);
assert.doesNotMatch(index, /navSettings|overlayColumn|overlayLink|overlayAction/);
assert.match(index, /marqueeSettings/);
assert.match(constants, /marqueeSettings: "marquee"/);
assert.doesNotMatch(constants, /navSettings/);

const marqueeBlock = singletons.slice(
  singletons.indexOf("export const marqueeSettings"),
);
assert.ok(marqueeBlock.length > 0);
for (const name of ["enabled", "availabilityLine"] as const) {
  assert.match(marqueeBlock, new RegExp(`name: "${name}"`));
}
for (const leftover of [
  "email",
  "overlayColumns",
  "sectionIds",
  "socials",
  "stacks",
  "availabilityCopies",
] as const) {
  assert.doesNotMatch(
    marqueeBlock,
    new RegExp(`name: "${leftover}"`),
    `marquee must not carry leftover nav field ${leftover}`,
  );
}

assert.match(structure, /singleton\(S, "marqueeSettings", "Marquee"\)/);
assert.doesNotMatch(structure, /navSettings|Preloader|preloader/);
assert.match(queries, /_id == "marquee"/);
assert.doesNotMatch(queries, /_id == "nav"/);

const siteBlock = singletons.slice(
  singletons.indexOf("export const siteSettings"),
  singletons.indexOf("export const aboutSettings"),
);
assert.match(siteBlock, /name: "preloader"[\s\S]{0,80}hidden: true/);

console.log("navSchema.check: marquee is a clean singleton; nav is not in Studio");
