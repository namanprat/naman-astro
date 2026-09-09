import { ARCHIVE_CONFIG } from "./archiveConfig.ts";
import { fibonacciSpherePoints, type Vec3 } from "./archiveLayout.ts";

/** One tile's place in the field, before any texture or geometry exists. */
export type ArchiveTilePlan = {
  index: number;
  /** Index into the loaded media sources, not into the archive manifest. */
  textureIndex: number;
  globePos: Vec3;
  isFiller: boolean;
};

/**
 * Which tile draws what, and where it sits on the sphere.
 *
 * Two classes out of one mesh set:
 *
 * - The first `sourceCount` tiles are the **orb** — one per archive item,
 *   spread over their own Fibonacci sphere, each carrying its own texture. No
 *   artwork appears twice, and the arrangement is identical on every load. It
 *   used to be `Math.random()` per tile against a hundred points, so eleven
 *   posters were drawn about nine times each, reshuffled every visit.
 *
 * - The rest are **filler**, and exist only so the grid keeps its density:
 *   eleven tiles would make the infinite grid wrap every 3x4 cells. They are
 *   invisible in orb view and fade in with the morph (`PosterTile`).
 *
 * Filler positions come from the full `gridTileCount` sphere rather than being
 * cloned onto their twin's point. Identical positions would tie the angular
 * sort in `assignWrappedGridCells` and stack every copy of one image onto the
 * grid's centre cells.
 *
 * Pure and DOM-free so `tests/archiveOrb.check.ts` can hold the no-duplicates
 * invariant without a WebGL context.
 */
export function planArchiveTiles(
  sourceCount: number,
  gridTileCount: number = ARCHIVE_CONFIG.gridTileCount,
  radius: number = ARCHIVE_CONFIG.sphereRadius,
): ArchiveTilePlan[] {
  if (sourceCount <= 0) return [];

  const orbPts = fibonacciSpherePoints(sourceCount, radius);
  const total = Math.max(sourceCount, gridTileCount);
  // Only worth generating when there is filler to place.
  const fillerPts =
    total > sourceCount ? fibonacciSpherePoints(total, radius) : [];

  const plan: ArchiveTilePlan[] = [];
  for (let index = 0; index < total; index++) {
    const isFiller = index >= sourceCount;
    plan.push({
      index,
      // Deterministic, and spread across the sources rather than clustered.
      textureIndex: isFiller ? index % sourceCount : index,
      globePos: (isFiller ? fillerPts[index] : orbPts[index])!,
      isFiller,
    });
  }
  return plan;
}
