import * as THREE from "three";

export type AsciiGrid = {
  geometry: THREE.InstancedBufferGeometry;
  cols: number;
  rows: number;
};

/** Screen-aligned instanced quads — shared by AsciiField and the hero reveal. */
export function buildAsciiGrid(density: number, aspect: number): AsciiGrid {
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
      random[index] = Math.pow(Math.random(), 4);
    }
  }

  const base = new THREE.PlaneGeometry(cellW, cellH, 1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.attributes.position);
  geometry.setAttribute("uv", base.attributes.uv);
  geometry.instanceCount = count;
  geometry.setAttribute(
    "aPosition",
    new THREE.InstancedBufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "aPixelUV",
    new THREE.InstancedBufferAttribute(pixelUv, 2),
  );
  geometry.setAttribute(
    "aRandom",
    new THREE.InstancedBufferAttribute(random, 1),
  );

  return { geometry, cols, rows };
}
