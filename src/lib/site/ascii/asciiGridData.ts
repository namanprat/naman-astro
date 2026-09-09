/**
 * The instanced-quad lattice, as plain typed arrays.
 *
 * ponytail: no `three` import, for the same reason `asciiAtlasBake.ts` has none.
 * Both the R3F canvases and the WebGPU stages want this lattice, and `three` and
 * `three/webgpu` are separate bundles whose `InstancedBufferGeometry` classes
 * are not interchangeable — so the arithmetic lives here and each side wraps its
 * own geometry around the result.
 *
 * Being free of the renderer also makes it checkable: the row/column split and
 * the cell centres are pure functions of two numbers, and getting them wrong
 * misaligns every glyph against the offscreen render it samples.
 */

export type AsciiGridData = {
  cols: number;
  rows: number;
  /** Quad size in the grid camera's clip units. */
  cellW: number;
  cellH: number;
  count: number;
  /** `vec3` per instance: the cell's centre, z always 0. */
  positions: Float32Array;
  /** `vec2` per instance: where the cell samples the offscreen render. */
  pixelUv: Float32Array;
  /** `float` per instance: the per-cell jitter seed. */
  random: Float32Array;
};

export function buildAsciiGridData(
  density: number,
  aspect: number,
): AsciiGridData {
  const rows = Math.max(2, Math.round(density));
  const cols = Math.max(2, Math.round(density * aspect));
  const cellW = (2 * aspect) / cols;
  const cellH = 2 / rows;
  const count = rows * cols;

  const positions = new Float32Array(count * 3);
  const pixelUv = new Float32Array(count * 2);
  const random = new Float32Array(count);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const index = i * rows + j;
      positions[index * 3] = -aspect + (i + 0.5) * cellW;
      positions[index * 3 + 1] = -1 + (j + 0.5) * cellH;
      positions[index * 3 + 2] = 0;
      pixelUv[index * 2] = (i + 0.5) / cols;
      pixelUv[index * 2 + 1] = (j + 0.5) / rows;
      // ponytail: the fourth power, not a flat random. `aRandom` feeds the
      // jitter that walks a cell's brightness, and a uniform distribution
      // brightened far too many cells at once — the bias keeps most cells near
      // zero so the jitter reads as occasional sparkle rather than noise.
      random[index] = Math.pow(Math.random(), 4);
    }
  }

  return { cols, rows, cellW, cellH, count, positions, pixelUv, random };
}
