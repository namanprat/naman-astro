/**
 * The archive orb's no-duplicates invariant, and the grid's density behind it.
 *
 * The orb used to draw `Math.random()` textures onto a hundred sphere points
 * against eleven sources, so every artwork appeared about nine times and the
 * arrangement changed on every load. These assertions are what stops that
 * coming back, and what stops the filler tiles — which exist only to keep the
 * grid dense — from clustering onto the grid's centre cells.
 *
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import { ARCHIVE_CONFIG } from "../src/lib/archive/archiveConfig.ts";
import { assignWrappedGridCells } from "../src/lib/archive/archiveLayout.ts";
import { planArchiveTiles } from "../src/lib/archive/archiveTilePlan.ts";

/** The live archive: eleven items against a hundred grid tiles. */
const SOURCES = 11;
const plan = planArchiveTiles(SOURCES);

assert.equal(
  plan.length,
  ARCHIVE_CONFIG.gridTileCount,
  "the field is still gridTileCount tiles — the surplus is filler, not gone",
);

const orb = plan.filter((tile) => !tile.isFiller);
assert.equal(orb.length, SOURCES, "the orb is exactly one tile per source");
assert.equal(
  new Set(orb.map((tile) => tile.textureIndex)).size,
  SOURCES,
  "no artwork appears twice in the orb",
);
assert.deepEqual(
  orb.map((tile) => tile.index),
  [...Array(SOURCES).keys()],
  "orb tiles are the leading indices, so `isFiller` is a suffix test",
);

assert.ok(
  plan.slice(SOURCES).every((tile) => tile.isFiller),
  "everything past the source count is filler",
);
assert.ok(
  plan.every((tile) => tile.textureIndex >= 0 && tile.textureIndex < SOURCES),
  "every tile points at a real source",
);

/* Deterministic: the whole point is that the orb reads the same on every load. */
assert.deepEqual(
  planArchiveTiles(SOURCES),
  plan,
  "the same inputs give the same orb, every time",
);

/* Filler positions come from the full sphere rather than being cloned onto
   their twin's point. Identical positions would tie the angular sort below and
   stack every copy of one image onto the grid's centre cells. */
const positions = plan.map((tile) => tile.globePos);
assert.equal(
  new Set(positions.map((p) => `${p.x},${p.y},${p.z}`)).size,
  plan.length,
  "no two tiles share a point on the sphere",
);

const cells = assignWrappedGridCells(plan.length, 0, positions);
assert.equal(cells.length, plan.length, "every tile gets a grid cell");
assert.equal(
  new Set(cells.map((c) => `${c.cx},${c.cy}`)).size,
  plan.length,
  "every tile gets a distinct grid cell — no stacking",
);
assert.deepEqual(cells[0], { cx: 0, cy: 0 }, "the anchor lands on the origin");

/* Degenerate inputs: a device that decoded nothing, and one that decoded more
   than the grid wants (`useArchiveMedia` drops failures, so the count varies). */
assert.deepEqual(planArchiveTiles(0), [], "no sources means no tiles");
const many = planArchiveTiles(ARCHIVE_CONFIG.gridTileCount + 5);
assert.equal(
  many.length,
  ARCHIVE_CONFIG.gridTileCount + 5,
  "more sources than grid tiles still gives every source its own tile",
);
assert.ok(
  many.every((tile) => !tile.isFiller),
  "and none of them are filler",
);

console.log("archiveOrb.check: ok");
