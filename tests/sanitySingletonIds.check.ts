/**
 * Every Studio singleton is reachable from GROQ.
 *   npm run test:unit
 *
 * The failure this catches is id drift: a singleton renamed in
 * `studio-duforn-portfolio/schemaTypes/constants.ts` while `queries.ts` still
 * asks for the old `_id`. Nothing throws when that happens — the query returns
 * null, the mapper drops the document, and the loader quietly serves the YAML
 * fallback, so the site keeps rendering last month's copy.
 */
import assert from "node:assert/strict";
import { SINGLETON_IDS } from "../studio-duforn-portfolio/schemaTypes/constants.ts";
import * as queries from "../src/lib/sanity/queries.ts";

const groq = Object.values(queries).join("\n");

for (const id of Object.values(SINGLETON_IDS)) {
  assert.ok(
    groq.includes(`"${id}"`),
    `singleton _id "${id}" is defined in the Studio but never queried in queries.ts`,
  );
}

// The two documents the home page was split across must both be read, and the
// About section has to come off the home page doc, not only the retired doc.
assert.match(queries.SITE_QUERY, /_id == "siteSettings"/);
assert.match(queries.ABOUT_QUERY, /\*\[_id == "site"\]\[0\]\.about/);

console.log(
  `sanitySingletonIds: ${Object.keys(SINGLETON_IDS).length} singletons queried.`,
);
