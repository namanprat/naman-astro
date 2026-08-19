import gsap from "gsap";
import { ARCHIVE_CONFIG } from "./archiveConfig";
import {
  assignWrappedGridCells,
  findFrontCenterTileIndex,
} from "./archiveLayout";
import { rigState, resetRigToOrb } from "./rigState";

let tween: gsap.core.Tween | null = null;

function prepareGridMorph() {
  const positions = rigState.globePositions;
  if (!positions.length) return;

  const anchorIdx = findFrontCenterTileIndex(positions, rigState.orientation);

  rigState.gridAnchorIndex = anchorIdx;
  rigState.tileGridCells = assignWrappedGridCells(
    positions.length,
    anchorIdx,
    positions,
  );

  rigState.gridPan.x = 0;
  rigState.gridPan.y = 0;
  rigState.gridPanTarget.x = 0;
  rigState.gridPanTarget.y = 0;
}

/** GSAP-driven morph between orb (0) and grid (1). */
export function requestArchiveMorph(onComplete?: () => void) {
  tween?.kill();
  rigState.isMorphing = true;

  // Snap zoom back to default on every transition so grid images don't inherit
  // the orb's zoom (camera damps to this during the morph).
  rigState.zoom = rigState.restZoom;

  if (rigState.morphTarget >= 1) {
    // Freeze the orb where it is — the unwrap interpolates from exactly what's on
    // screen to the centered grid, so no rotation sweep / jump.
    prepareGridMorph();
  }

  tween = gsap.to(rigState, {
    morph: rigState.morphTarget,
    duration: ARCHIVE_CONFIG.morphDuration,
    ease: "power2.inOut",
    onComplete: () => {
      rigState.isMorphing = false;
      if (rigState.morphTarget < 0.5) resetRigToOrb();
      tween = null;
      onComplete?.();
    },
  });
}
