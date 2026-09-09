// Orb + grid field constants.
export const ARCHIVE_CONFIG = {
  /**
   * Tiles in the *grid* wallpaper, not in the orb. The orb draws one tile per
   * archive item — see `ArchivePosterField`. The surplus above that count are
   * "filler" tiles: invisible in orb view, faded in by the morph so the grid
   * keeps its density rather than tiling eleven images every three cells.
   */
  gridTileCount: 100,
  clickThreshold: 5,

  // Resting camera distance + the wheel-zoom range. Default sits mid-range so you
  // can zoom both in and out; min stays outside the sphere so zooming in never
  // enters the orb. Scaled with `sphereRadius` — these are ~2x/1.3x/2.8x of it.
  globeZoom: 6.4,
  globeZoomMin: 4.2,
  globeZoomMax: 9,
  globeWheelSpeed: 0.01,
  zoomDamp: 0.25,
  globeSpin: 0.06,
  spinSensitivity: 0.005,
  /** Desktop grid pan — 44% lighter than base (0.7 × 0.8 of pointer travel). */
  gridPanDesktopScale: 0.56,
  /** Touch grid pan — worldPerPx carries a 2.5 fudge (vs the true 2.0), so 0.8 restores 1:1 finger tracking. */
  gridPanTouchScale: 0.8,
  /** Grid drag smoothing while panning, all pointers (higher = tighter follow). */
  gridPanDragLerp: 11,
  /** Release momentum — how many ms of the release velocity to glide past the lift point. */
  gridPanFlingMs: 220,

  /* Tightened from 5, and posters scaled up to match, when the orb stopped
     repeating itself: eleven unique tiles have to cover the solid angle a
     hundred used to. Both numbers are eyeballed — the orb should read full
     without tiles overlapping into a shell. */
  sphereRadius: 3.2,
  baseHeight: 0.6,
  posterScale: 2.5,
  globeScaleBoost: 1.15,

  morphDuration: 1.4,

  /**
   * Camera distance in grid view.
   *
   * Its own number, not `globeZoom`: the camera does not dolly on the morph,
   * so tightening the orb's zoom for a sphere of eleven posters would zoom the
   * grid in with it and leave one poster filling the screen. This is the
   * distance the grid was always framed at.
   */
  gridZoom: 10,

  /* The next two size the grid in its own terms, rather than as a multiple of
     an orb tile.

     That used to be `gridScaleVsOrb`, which looked like it controlled how much
     bigger the grid read but did not: the cell size derived from it as well,
     and `posterScale` cancelled out of that derivation entirely, so a poster
     always filled `baseHeight * posterScale` of its cell. Scaling the orb's
     posters up to cover a sphere of eleven therefore overflowed every grid
     cell, and no value of `gridScaleVsOrb` could correct it — it moved both
     halves at once. These two the orb cannot reach. The values are the old
     derived ones exactly: 1.15 × 10, and 0.6 × 1.2. */
  /** World units between grid tiles, before `gridSpacing`. */
  gridCellSize: 11.5,
  /** How much of its cell a grid poster's long edge fills. */
  gridPosterFill: 0.72,
  // Extra spacing between grid tiles (1 = tiles touch their cell, 2 = double the gap).
  gridSpacing: 1,
  unwrapScale: 2.8,

  /* Lightbox. The clicked tile flies to `focusZ` — in front of the whole
     sphere, so ordinary depth testing draws it over the orb with no
     renderOrder tricks — while the camera pulls back to `focusZoom` to make
     room. `focusYOffset` lifts it clear of the caption band. */
  focusZoom: 9.5,
  focusZ: 4.8,
  focusHeight: 4,
  focusYOffset: 0.5,
  focusDuration: 0.7,
} as const;

/* troika (drei's <Text>) needs a direct font-file URL, not a CSS family name.
   duforn hardcoded a Typekit CDN URL carrying its own kit token, which isn't
   ours to ship — this points at the local face the site already serves. Swap
   the path if you want the centre word in a different cut.

   .ttf, not the .woff2 the CSS `@font-face` uses: troika refuses woff2
   outright ("woff2 fonts not supported"), and the whole word silently fails to
   render. Same cut, ~170KB, and only the archive route pays for it. */
export const ARCHIVE_PRIMARY_FONT = "/fonts/HitmarkerCondensed-Black.ttf";

export const ARCHIVE_GLOBE_HEIGHT =
  ARCHIVE_CONFIG.baseHeight *
  ARCHIVE_CONFIG.posterScale *
  ARCHIVE_CONFIG.globeScaleBoost;

/** Poster height in grid mode. Camera keeps the orb zoom, so this is the size. */
export const ARCHIVE_GRID_HEIGHT =
  ARCHIVE_CONFIG.gridCellSize * ARCHIVE_CONFIG.gridPosterFill;

/** Cell pitch — `gridSpacing` widens the gap between grid tiles. */
export const ARCHIVE_GRID_CELL_SIZE =
  ARCHIVE_CONFIG.gridCellSize * ARCHIVE_CONFIG.gridSpacing;

/**
 * Grid laid out as a centered COLS×ROWS block that tiles infinitely in both
 * axes (the wrap period). ponytail: assumes a square-ish gridTileCount — 100 → 10×10.
 */
export const ARCHIVE_GRID_COLS = Math.round(
  Math.sqrt(ARCHIVE_CONFIG.gridTileCount),
);
export const ARCHIVE_GRID_ROWS = Math.ceil(
  ARCHIVE_CONFIG.gridTileCount / ARCHIVE_GRID_COLS,
);

/** Unwrap spread scaled to grid cells (legacy fallback; morph uses symmetric cells). */
export const ARCHIVE_UNWRAP_SCALE =
  ARCHIVE_GRID_CELL_SIZE * (ARCHIVE_CONFIG.unwrapScale / 1.15);
