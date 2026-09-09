import gsap from "gsap";
import type { ArchiveItem } from "@/content/archive";
import { prefersReducedMotion } from "@/lib/site/util/prefersReducedMotion";
import { ARCHIVE_CONFIG } from "./archiveConfig";
import { rigState } from "./rigState";
import "@/lib/site/util/eases";

/**
 * Which poster the lightbox is holding open.
 *
 * Split the same way `archiveView` / `rigMorph` are: this store is the React
 * surface (the caption is DOM), while the per-frame side lives on `rigState` as
 * a scalar GSAP tweens and every `PosterTile` reads in its own `useFrame`. No
 * React render is ever in the animation loop.
 */
export type ArchiveFocusSnapshot = {
  /** Tile index the orb is focusing, or -1. */
  index: number;
  item: ArchiveItem | null;
};

const CLOSED: ArchiveFocusSnapshot = { index: -1, item: null };

let snapshot: ArchiveFocusSnapshot = CLOSED;
const listeners = new Set<() => void>();
let tween: gsap.core.Tween | null = null;

function emit(next: ArchiveFocusSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function subscribeArchiveFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getArchiveFocusSnapshot(): ArchiveFocusSnapshot {
  return snapshot;
}

/**
 * How much the rest of the scene is dimmed for the lightbox, 0-1.
 *
 * The dimming is done in WebGL rather than with a DOM scrim: the opened poster
 * is itself a tile inside the canvas, so anything painted over the canvas would
 * darken the artwork along with the orb behind it.
 */
export function archiveFocusDim(): number {
  return rigState.focusIndex >= 0 ? rigState.focusT : 0;
}

/** Tween `rigState.focusT` to `to`, or jump when motion is not wanted. */
function driveFocusT(to: number, onComplete?: () => void) {
  tween?.kill();
  if (prefersReducedMotion()) {
    rigState.focusT = to;
    tween = null;
    onComplete?.();
    return;
  }
  tween = gsap.to(rigState, {
    focusT: to,
    duration: ARCHIVE_CONFIG.focusDuration,
    ease: "hop",
    onComplete: () => {
      tween = null;
      onComplete?.();
    },
  });
}

export function openArchiveFocus(index: number, item: ArchiveItem): void {
  if (snapshot.index === index) return;
  // Only stash the zoom on the way in from a closed orb — reopening straight
  // onto another tile would otherwise stash `focusZoom` as the resting one.
  if (snapshot.index < 0) rigState.zoomBeforeFocus = rigState.zoom;
  rigState.focusIndex = index;
  // Pull the camera back so there is room in front of the sphere for the tile
  // to fly into; `ArchiveRig`'s existing camera damp does the move.
  rigState.zoom = ARCHIVE_CONFIG.focusZoom;
  emit({ index, item });
  driveFocusT(1);
}

export function closeArchiveFocus(): void {
  if (snapshot.index < 0) return;
  rigState.zoom = rigState.zoomBeforeFocus;
  emit(CLOSED);
  // `focusIndex` outlives the emit: the tile has to keep reading it to fly
  // home. It is released only once the tween has landed.
  driveFocusT(0, () => {
    rigState.focusIndex = -1;
  });
}

/** Drop focus without animating — archive enter / unmount. */
export function resetArchiveFocus(): void {
  tween?.kill();
  tween = null;
  rigState.focusT = 0;
  rigState.focusIndex = -1;
  snapshot = CLOSED;
  listeners.forEach((listener) => listener());
}
