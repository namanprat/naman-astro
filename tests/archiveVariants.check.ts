/**
 * The archive's poster caps live in two files that cannot import each other:
 * `scripts/archive-variants.mjs` runs under plain `node` in the `prebuild`
 * hook, and `src/lib/archive/archiveLoadMedia.ts` ships to the browser. The
 * variant URL is built from the number on both sides, so they have to agree.
 *
 * Drift here fails *silently*: the loader asks for `-1024.webp`, the build
 * wrote `-1200.webp`, the fetch 404s and the catch falls back to the master.
 * The archive still works — it just quietly goes back to being 5MB, which is
 * the bug this whole thing exists to fix. Hence a check rather than a comment.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const script = readFileSync("scripts/archive-variants.mjs", "utf8");
const loader = readFileSync("src/lib/archive/archiveLoadMedia.ts", "utf8");

const scriptCaps = readScriptCaps(script);
const loaderCaps = readLoaderCaps(loader);

assert.ok(scriptCaps.length > 0, "no CAPS array found in archive-variants.mjs");
assert.deepEqual(
  [...loaderCaps].sort((a, b) => a - b),
  [...scriptCaps].sort((a, b) => a - b),
  `archive caps drifted: script emits ${scriptCaps.join("/")}, loader asks for ${loaderCaps.join("/")}`,
);

/* The loader has to name the same directory the script writes into, for the
   same reason — a wrong path is another silent fallback. */
assert.match(
  loader,
  /\/generated\//,
  "the loader no longer points at the generated/ directory",
);
assert.match(
  script,
  /path\.join\(SOURCE_DIR, "generated"\)/,
  "the variant script no longer writes into generated/",
);

/** `const CAPS = [1024, 1600];` */
function readScriptCaps(source: string): number[] {
  const match = /const CAPS = \[([^\]]+)\]/.exec(source);
  if (!match) return [];
  return match[1]!.split(",").map((n) => Number(n.trim()));
}

/** `const TEXTURE_CAPS = { mobile: 1024, desktop: 1600 } as const;` */
function readLoaderCaps(source: string): number[] {
  const match = /const TEXTURE_CAPS = \{([^}]+)\}/.exec(source);
  if (!match) return [];
  return [...match[1]!.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
}

console.log("archiveVariants: all assertions passed");
