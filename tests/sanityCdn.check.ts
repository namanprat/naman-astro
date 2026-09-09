/**
 * Archive loader and seed-time URLs share the same Sanity CDN width helper.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSanityCdnUrl, withSanityWidth } from "../src/lib/sanity/cdn.ts";

assert.equal(isSanityCdnUrl("/archive/brhm.webp"), false);
assert.equal(
  isSanityCdnUrl("https://cdn.sanity.io/images/dj9l9mvw/production/abc.webp"),
  true,
);

const widened = withSanityWidth(
  "https://cdn.sanity.io/images/dj9l9mvw/production/abc.webp",
  1024,
);
assert.match(widened, /[?&]w=1024/);
assert.match(widened, /auto=format/);

const loader = readFileSync("src/lib/archive/archiveLoadMedia.ts", "utf8");
assert.match(
  loader,
  /isSanityCdnUrl/,
  "archive loader must resize Sanity URLs, not only local generated/",
);
assert.match(loader, /setCrossOrigin\("anonymous"\)/);

console.log("sanityCdn: all assertions passed");
