/**
 * `buildAsciiGrid`, built from `three/webgpu` instead of `three`.
 *
 * ponytail: a near-duplicate rather than a shared implementation, for the same
 * reason `cssColorGpu.ts` is one — the two `InstancedBufferGeometry` classes are
 * structurally identical and mutually unassignable, so anything shared would
 * need a cast at exactly the boundary the split exists to police. Everything
 * with a decision in it is in `asciiGridData.ts`; this is only the wrapping.
 */
import {
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  PlaneGeometry,
} from "three/webgpu";
import { buildAsciiGridData } from "./asciiGridData";

export type AsciiGridGpu = {
  geometry: InstancedBufferGeometry;
  cols: number;
  rows: number;
};

export function buildAsciiGridGpu(
  density: number,
  aspect: number,
): AsciiGridGpu {
  const data = buildAsciiGridData(density, aspect);

  const base = new PlaneGeometry(data.cellW, data.cellH, 1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.attributes.position);
  geometry.setAttribute("uv", base.attributes.uv);
  geometry.instanceCount = data.count;
  geometry.setAttribute(
    "aPosition",
    new InstancedBufferAttribute(data.positions, 3),
  );
  geometry.setAttribute(
    "aPixelUV",
    new InstancedBufferAttribute(data.pixelUv, 2),
  );
  geometry.setAttribute(
    "aRandom",
    new InstancedBufferAttribute(data.random, 1),
  );

  return { geometry, cols: data.cols, rows: data.rows };
}
