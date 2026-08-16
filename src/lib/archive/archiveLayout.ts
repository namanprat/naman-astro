import * as THREE from "three";
import {
  ARCHIVE_CONFIG,
  ARCHIVE_GRID_COLS,
  ARCHIVE_GRID_ROWS,
  ARCHIVE_UNWRAP_SCALE,
} from "./archiveConfig";

export type Vec3 = { x: number; y: number; z: number };

export type CellId = { cx: number; cy: number };

export type CellBounds = {
  minCx: number;
  maxCx: number;
  minCy: number;
  maxCy: number;
};

const _v = new THREE.Vector3();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3(0, 0, 1);
const _qAlign = new THREE.Quaternion();

/** Even-ish spread of `count` points on a sphere of `radius` (Fibonacci spiral). */
export function fibonacciSpherePoints(count: number, radius: number): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    pts.push({
      x: radius * Math.cos(theta) * Math.sin(phi),
      y: radius * Math.sin(theta) * Math.sin(phi),
      z: radius * Math.cos(phi),
    });
  }
  return pts;
}

/** Apply the orb's arcball orientation — same quaternion PosterTile uses. */
export function rotateGlobePoint(pos: Vec3, orientation: THREE.Quaternion): Vec3 {
  _v.set(pos.x, pos.y, pos.z).applyQuaternion(orientation);
  return { x: _v.x, y: _v.y, z: _v.z };
}

/** Front-facing tile nearest screen center (tie-break: closer to camera). */
export function findFrontCenterTileIndex(
  globePositions: Vec3[],
  orientation: THREE.Quaternion,
): number {
  let best = 0;
  let bestDist = Infinity;
  let bestZ = -Infinity;

  for (let i = 0; i < globePositions.length; i++) {
    const r = rotateGlobePoint(globePositions[i]!, orientation);
    if (r.z <= 0) continue;
    const dist = Math.hypot(r.x, r.y);
    if (dist < bestDist || (dist === bestDist && r.z > bestZ)) {
      best = i;
      bestDist = dist;
      bestZ = r.z;
    }
  }

  return best;
}

/** Stereographic unwrap from north pole — peels sphere onto z=0. */
export function stereographicUnwrap(
  globePos: Vec3,
  radius: number,
  scale = ARCHIVE_UNWRAP_SCALE,
): Vec3 {
  const denom = radius - globePos.z;
  const k = Math.abs(denom) < 1e-4 ? scale : (scale * radius) / denom;
  return { x: globePos.x * k, y: globePos.y * k, z: 0 };
}

/** Unwrap relative to anchor direction — anchor lands at (0, 0). */
export function stereographicUnwrapFromAnchor(
  globePos: Vec3,
  anchorDir: Vec3,
  radius: number,
  scale = ARCHIVE_UNWRAP_SCALE,
): Vec3 {
  _from.set(anchorDir.x, anchorDir.y, anchorDir.z).normalize();
  _qAlign.setFromUnitVectors(_from, _to);
  _v.set(globePos.x, globePos.y, globePos.z).applyQuaternion(_qAlign);
  return stereographicUnwrap({ x: _v.x, y: _v.y, z: _v.z }, radius, scale);
}

export function unwrapToCellOffset(
  unwrapPos: Vec3,
  gridCellSize: number,
): { dx: number; dy: number } {
  return {
    dx: Math.round(unwrapPos.x / gridCellSize),
    dy: Math.round(unwrapPos.y / gridCellSize),
  };
}

export function cellIdFromWorld(x: number, y: number, cellSize: number): CellId {
  return {
    cx: Math.floor(x / cellSize),
    cy: Math.floor(y / cellSize),
  };
}

export function worldFromCell(cx: number, cy: number, cellSize: number, panX = 0, panY = 0): Vec3 {
  return {
    x: cx * cellSize + panX,
    y: cy * cellSize + panY,
    z: 0,
  };
}

/** Phantom-style hash for which texture fills a cell. */
export function textureIndexForCell(cx: number, cy: number, count: number): number {
  if (count <= 0) return 0;
  const raw = cx + cy * 3;
  return ((raw % count) + count) % count;
}

export function visibleCellBounds(
  panX: number,
  panY: number,
  cameraZ: number,
  fovDeg: number,
  aspect: number,
  cellSize: number,
  padding = 2,
): CellBounds {
  const vFov = (fovDeg * Math.PI) / 180;
  const halfH = cameraZ * Math.tan(vFov / 2);
  const halfW = halfH * aspect;

  const minX = panX - halfW;
  const maxX = panX + halfW;
  const minY = panY - halfH;
  const maxY = panY + halfH;

  return {
    minCx: Math.floor(minX / cellSize) - padding,
    maxCx: Math.ceil(maxX / cellSize) + padding,
    minCy: Math.floor(minY / cellSize) - padding,
    maxCy: Math.ceil(maxY / cellSize) + padding,
  };
}

export function listCellsInBounds(bounds: CellBounds): CellId[] {
  const cells: CellId[] = [];
  for (let cy = bounds.minCy; cy <= bounds.maxCy; cy++) {
    for (let cx = bounds.minCx; cx <= bounds.maxCx; cx++) {
      cells.push({ cx, cy });
    }
  }
  return cells;
}

/**
 * COLS×ROWS block (the wrap tile) — the front-center image lands on cell (0,0) =
 * viewport centre, neighbours by angular distance spiral outward. A complete
 * rectangle, so it tiles seamlessly when wrapped in both axes.
 */
export function assignWrappedGridCells(
  tileCount: number,
  anchorIndex: number,
  globePositions: Vec3[],
): CellId[] {
  const anchor = globePositions[anchorIndex]!;
  const r2 = ARCHIVE_CONFIG.sphereRadius ** 2;
  const angularDist = (i: number) => {
    const p = globePositions[i]!;
    const dot = (anchor.x * p.x + anchor.y * p.y + anchor.z * p.z) / r2;
    return Math.acos(Math.min(1, Math.max(-1, dot)));
  };

  // Rectangle of integer cells including (0,0), sorted central-first so the
  // anchor lands exactly on the origin.
  const ox = Math.floor(ARCHIVE_GRID_COLS / 2);
  const oy = Math.floor(ARCHIVE_GRID_ROWS / 2);
  const rect: CellId[] = [];
  for (let r = 0; r < ARCHIVE_GRID_ROWS; r++) {
    for (let c = 0; c < ARCHIVE_GRID_COLS; c++) {
      rect.push({ cx: c - ox, cy: r - oy });
    }
  }
  rect.sort((a, b) => Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy));

  // Tiles sorted nearest-anchor-first, zipped onto central-first cells.
  const order = Array.from({ length: tileCount }, (_, i) => i);
  order.sort((a, b) => angularDist(a) - angularDist(b));

  const cells: CellId[] = new Array(tileCount);
  for (let k = 0; k < order.length; k++) {
    cells[order[k]!] = rect[k] ?? { cx: 0, cy: 0 };
  }
  return cells;
}

/**
 * World position of a tile's home cell, wrapped to the copy nearest the viewport
 * centre — gives an infinite, seamless grid in both axes. Camera stays put; the
 * images move. `pan` is the world pan offset; the cell under the camera is -pan/size.
 */
export function wrappedCellWorld(
  home: CellId,
  panX: number,
  panY: number,
  cellSize: number,
  cols = ARCHIVE_GRID_COLS,
  rows = ARCHIVE_GRID_ROWS,
): Vec3 {
  const cx = home.cx + cols * Math.round((-panX / cellSize - home.cx) / cols);
  const cy = home.cy + rows * Math.round((-panY / cellSize - home.cy) / rows);
  return { x: cx * cellSize + panX, y: cy * cellSize + panY, z: 0 };
}

// ponytail: self-check — fails in devtools if layout math regresses.
(() => {
  const p = stereographicUnwrap({ x: 5, y: 0, z: 0 }, 5);
  console.assert(p.z === 0 && p.x > 0, "stereographicUnwrap");
  console.assert(textureIndexForCell(4, 2, 10) === 0, "textureIndexForCell");

  const anchor = { x: 0, y: 0.6, z: 0.8 };
  const len = Math.hypot(anchor.x, anchor.y, anchor.z);
  const dir = { x: anchor.x / len, y: anchor.y / len, z: anchor.z / len };
  const atAnchor = stereographicUnwrapFromAnchor(
    { x: dir.x * 5, y: dir.y * 5, z: dir.z * 5 },
    dir,
    5,
  );
  console.assert(
    Math.hypot(atAnchor.x, atAnchor.y) < 0.01,
    "stereographicUnwrapFromAnchor anchor at center",
  );

  const wcells = assignWrappedGridCells(5, 2, [
    { x: 5, y: 0, z: 0 },
    { x: 0, y: 5, z: 0 },
    { x: 0, y: 0, z: 5 },
    { x: -5, y: 0, z: 0 },
    { x: 0, y: -5, z: 0 },
  ]);
  console.assert(
    wcells[2]!.cx === 0 && wcells[2]!.cy === 0,
    "assignWrappedGridCells anchor at origin",
  );

  // Layout repeats every period — proves the grid wraps seamlessly in both axes.
  const home = { cx: 1, cy: -2 };
  const w0 = wrappedCellWorld(home, 0, 0, 2);
  const wP = wrappedCellWorld(home, ARCHIVE_GRID_COLS * 2, ARCHIVE_GRID_ROWS * 2, 2);
  console.assert(
    Math.abs(w0.x - wP.x) < 1e-9 && Math.abs(w0.y - wP.y) < 1e-9,
    "wrappedCellWorld periodic",
  );
})();
