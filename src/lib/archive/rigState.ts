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

  morph: 0,
  morphTarget: 0,
  isMorphing: false,

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
