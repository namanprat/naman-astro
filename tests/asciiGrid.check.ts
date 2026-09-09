/**
 * Self-check for the ASCII lattice arithmetic.
 *   npm run test:unit
 *
 * The lattice is what welds a glyph to the pixel it represents: `aPixelUV` names
 * where a cell samples the offscreen render of the real 3D subject, and
 * `aPosition` is where the quad sits on screen. If those two drift apart the
 * field still renders — it just samples the wrong part of the subject, which
 * reads as a smeared or shifted image rather than as an error.
 */
import assert from "node:assert/strict";
import { buildAsciiGridData } from "../src/lib/site/ascii/asciiGridData.ts";

// Density is rows; columns follow the aspect, so a wide box gets wide coverage.
{
  const square = buildAsciiGridData(40, 1);
  assert.equal(square.rows, 40);
  assert.equal(square.cols, 40);
  assert.equal(square.count, 1600);

  const wide = buildAsciiGridData(40, 2);
  assert.equal(wide.rows, 40, "rows track density alone");
  assert.equal(wide.cols, 80, "columns track density x aspect");
}

// Two rows minimum: a degenerate lattice divides by zero downstream.
{
  const tiny = buildAsciiGridData(0, 0);
  assert.equal(tiny.rows, 2);
  assert.equal(tiny.cols, 2);
}

// Cells tile the clip box exactly — no gap, no overlap.
{
  const g = buildAsciiGridData(10, 1.5);
  assert.ok(
    Math.abs(g.cellW * g.cols - 2 * 1.5) < 1e-12,
    "columns span the full [-aspect, aspect]",
  );
  assert.ok(
    Math.abs(g.cellH * g.rows - 2) < 1e-12,
    "rows span the full [-1, 1]",
  );
}

// Every attribute is sized for the instance count.
{
  const g = buildAsciiGridData(8, 1);
  assert.equal(g.positions.length, g.count * 3);
  assert.equal(g.pixelUv.length, g.count * 2);
  assert.equal(g.random.length, g.count);
}

/**
 * The corner cell sits half a cell inside the box, and samples the matching
 * corner of the render. This is the pairing that must not drift.
 *
 * ponytail: a float32 epsilon, not an exact compare. The attributes are
 * `Float32Array`s destined for the GPU, so every value here has been rounded
 * from the float64 the arithmetic produced.
 */
{
  const EPS = 1e-6;
  const aspect = 1.5;
  const g = buildAsciiGridData(10, aspect);
  assert.ok(
    Math.abs(g.positions[0] - (-aspect + g.cellW / 2)) < EPS,
    "first column is half a cell in from the left edge",
  );
  assert.ok(
    Math.abs(g.positions[1] - (-1 + g.cellH / 2)) < EPS,
    "first row is half a cell up from the bottom edge",
  );
  assert.ok(
    Math.abs(g.pixelUv[0] - 0.5 / g.cols) < EPS,
    "and samples the centre of the matching texel column",
  );
  assert.ok(Math.abs(g.pixelUv[1] - 0.5 / g.rows) < EPS);

  // Last instance is the opposite corner, in both spaces.
  const last = g.count - 1;
  assert.ok(Math.abs(g.positions[last * 3] - (aspect - g.cellW / 2)) < EPS);
  assert.ok(Math.abs(g.pixelUv[last * 2] - (1 - 0.5 / g.cols)) < EPS);
}

// Every position is inside the clip box, and every UV inside [0, 1].
{
  const aspect = 0.75;
  const g = buildAsciiGridData(12, aspect);
  for (let i = 0; i < g.count; i++) {
    assert.ok(
      Math.abs(g.positions[i * 3]) <= aspect + 1e-6,
      "x within the box",
    );
    assert.ok(Math.abs(g.positions[i * 3 + 1]) <= 1 + 1e-6, "y within the box");
    assert.equal(g.positions[i * 3 + 2], 0, "the lattice is flat");
    assert.ok(g.pixelUv[i * 2] > 0 && g.pixelUv[i * 2] < 1);
    assert.ok(g.pixelUv[i * 2 + 1] > 0 && g.pixelUv[i * 2 + 1] < 1);
    assert.ok(g.random[i] >= 0 && g.random[i] < 1);
  }
}

/**
 * The jitter seed is biased low on purpose: it walks a cell's brightness, and a
 * flat distribution lit far too many cells at once.
 *
 * Checked against the fourth power's actual tail rather than a round number —
 * for `random()**4`, P(x > t) is `1 - t**0.25`, so a half of the seeds above 0.5
 * would be uniform and about 16% is the bias working. A loose "less than half"
 * would pass on `random()**2` as well, which is a different look.
 */
{
  const g = buildAsciiGridData(60, 1);
  const above = (t: number) =>
    [...g.random].filter((v) => v > t).length / g.count;
  for (const t of [0.25, 0.5, 0.75]) {
    const expected = 1 - Math.pow(t, 0.25);
    assert.ok(
      Math.abs(above(t) - expected) < 0.03,
      `P(seed > ${t}) should be about ${(expected * 100).toFixed(1)}%, got ${(
        above(t) * 100
      ).toFixed(1)}%`,
    );
  }
}

console.log("asciiGrid: all assertions passed");
