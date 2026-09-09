import * as THREE from "three";
import { ARCHIVE_CONFIG } from "./archiveConfig";
import type { CellId, Vec3 } from "./archiveLayout";

export const rigState = {
  /* Widened: ARCHIVE_CONFIG is `as const`, so this would otherwise infer the
     literal 10 and the wheel handler couldn't write a zoom back into it. */
  zoom: ARCHIVE_CONFIG.globeZoom as number,
  /** Arcball orbit orientation — current (damped) and drag/idle target. */
  orientation: new THREE.Quaternion(),
  orientationTarget: new THREE.Quaternion(),
  isDragging: false,

  /**
   * Latched at pointer-up: was the gesture that just ended a drag?
   *
   * `isDragging` cannot answer this for a click handler — `pointerup` clears it
   * before `click` fires, so a tile's `onClick` would always see `false` and a
   * drag that ended over a poster would open it.
   */
  wasDrag: false,

  morph: 0,
  morphTarget: 0,
  isMorphing: false,

  /**
   * How many posters the pointer is inside.
   *
   * A counter, not a boolean: the sphere's planes overlap heavily, so crossing
   * from one poster to the next fires `pointerout` after `pointerover`, and a
   * boolean would flicker the cursor on every move. Read by `ArchiveRig`, which
   * owns the cursor, so a drag ending over a poster does not leave it on `grab`.
   */
  hoverTiles: 0,

  /** Lightbox: tile index the orb is holding open, and its 0→1 fly-out. */
  focusIndex: -1,
  focusT: 0,
  /** Zoom to restore when the lightbox closes. */
  zoomBeforeFocus: ARCHIVE_CONFIG.globeZoom as number,

  gridPan: { x: 0, y: 0 },
  gridPanTarget: { x: 0, y: 0 },
  isGridPanning: false,

  /** Populated when tiles build — used for anchor pick on grid morph. */
  globePositions: [] as Vec3[],
  tileTextureIndices: [] as number[],

  gridAnchorIndex: -1,
  gridAnchorTextureIndex: 0,
  tileGridCells: [] as CellId[],
};

export function resetRigToOrb(): void {
  rigState.zoom = ARCHIVE_CONFIG.globeZoom;
  rigState.gridPan.x = 0;
  rigState.gridPan.y = 0;
  rigState.gridPanTarget.x = 0;
  rigState.gridPanTarget.y = 0;
  rigState.isGridPanning = false;
  rigState.gridAnchorIndex = -1;
  rigState.gridAnchorTextureIndex = 0;
  rigState.tileGridCells = [];
}
