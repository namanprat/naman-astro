import * as THREE from "three";
import { buildAsciiGridData } from "./asciiGridData";

export type AsciiGrid = {
  geometry: THREE.InstancedBufferGeometry;
  cols: number;
  rows: number;
};

/**
 * Screen-aligned instanced quads — shared by AsciiField and the hero reveal.
 *
 * The lattice arithmetic lives in `asciiGridData.ts`, which imports nothing;
 * this is only the `three` geometry around it.
 */
export function buildAsciiGrid(density: number, aspect: number): AsciiGrid {
  const data = buildAsciiGridData(density, aspect);

  const base = new THREE.PlaneGeometry(data.cellW, data.cellH, 1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.attributes.position);
  geometry.setAttribute("uv", base.attributes.uv);
  geometry.instanceCount = data.count;
  geometry.setAttribute(
    "aPosition",
    new THREE.InstancedBufferAttribute(data.positions, 3),
  );
  geometry.setAttribute(
    "aPixelUV",
    new THREE.InstancedBufferAttribute(data.pixelUv, 2),
  );
  geometry.setAttribute(
    "aRandom",
    new THREE.InstancedBufferAttribute(data.random, 1),
  );

  return { geometry, cols: data.cols, rows: data.rows };
}
