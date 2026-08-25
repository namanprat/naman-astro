/**
 * Self-check for the desktop footer ASCII wordmark.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import {
  footerAsciiInk,
  SWATCH_BLACK,
  SWATCH_LIGHT,
} from "../src/lib/site/siteColors.ts";

assert.equal(
  footerAsciiInk(true),
  SWATCH_LIGHT,
  "light theme paints the wordmark white",
);
assert.equal(
  footerAsciiInk(false),
  SWATCH_BLACK,
  "dark theme paints the wordmark black",
);

console.log("footerAscii: all assertions passed");
