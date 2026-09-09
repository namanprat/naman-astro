/**
 * Self-check for slash-free route compares.
 *   npm run test:unit
 *
 * Astro writes trailing-slash folder URLs into `Astro.url.pathname` at build
 * time (`/about/`, `/archive/`). Menu and BaseLayout have to compare the
 * slash-free form or `/about` still SSR's the overlay and `/archive` still
 * mounts the fluid canvas.
 */
import assert from "node:assert/strict";
import { isNoindexRoute, pagePathname } from "../src/utils/seo.ts";

assert.equal(pagePathname("/"), "/");
assert.equal(pagePathname("/about"), "/about");
assert.equal(pagePathname("/about/"), "/about");
assert.equal(pagePathname("about"), "/about");
assert.equal(pagePathname("/archive/"), "/archive");
assert.equal(pagePathname("/work/money-me/"), "/work/money-me");

assert.equal(isNoindexRoute("/about"), true);
assert.equal(isNoindexRoute("/about/"), true);
assert.equal(isNoindexRoute("/work"), false);

console.log("pagePathname: all assertions passed");
