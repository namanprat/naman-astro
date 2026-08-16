// Orb + grid field constants.
export const ARCHIVE_CONFIG = {
  tileCount: 100,
  clickThreshold: 5,

  // Resting camera distance + the wheel-zoom range. Default sits mid-range so you
  // can zoom both in and out; min stays outside the sphere (radius 5) so zooming in
  // never enters the orb.
  globeZoom: 10,
  globeZoomMin: 6.5,
  globeZoomMax: 14,
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

  sphereRadius: 5,
  baseHeight: 0.6,
  posterScale: 1.2,
  globeScaleBoost: 1.15,

  morphDuration: 1.4,
  // Grid tile size relative to an orb tile. Camera keeps the orb zoom in grid, so
  // this alone controls how much bigger the images read: 10 → 1000% of orb size.
  gridScaleVsOrb: 10,
  // Extra spacing between grid tiles (1 = tiles touch their cell, 2 = double the gap).
  gridSpacing: 1.5 / 1.5,
  gridGap: 0.38,
  unwrapScale: 2.8,
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

/** Poster height in grid mode — `gridScaleVsOrb`× the orb tile (camera keeps orb zoom). */
export const ARCHIVE_GRID_HEIGHT =
  ARCHIVE_GLOBE_HEIGHT * ARCHIVE_CONFIG.gridScaleVsOrb;

/** Cell = poster-fill size × gridSpacing — controls the gap between grid tiles. */
export const ARCHIVE_GRID_CELL_SIZE =
  (ARCHIVE_GRID_HEIGHT /
    (ARCHIVE_CONFIG.baseHeight * ARCHIVE_CONFIG.posterScale)) *
  ARCHIVE_CONFIG.gridSpacing;

/**
 * Grid laid out as a centered COLS×ROWS block that tiles infinitely in both
 * axes (the wrap period). ponytail: assumes a square-ish tileCount — 100 → 10×10.
 */
export const ARCHIVE_GRID_COLS = Math.round(
  Math.sqrt(ARCHIVE_CONFIG.tileCount),
);
export const ARCHIVE_GRID_ROWS = Math.ceil(
  ARCHIVE_CONFIG.tileCount / ARCHIVE_GRID_COLS,
);

/** Unwrap spread scaled to grid cells (legacy fallback; morph uses symmetric cells). */
export const ARCHIVE_UNWRAP_SCALE =
  ARCHIVE_GRID_CELL_SIZE * (ARCHIVE_CONFIG.unwrapScale / 1.15);

/** GridHelper: 120 units / 60 divisions = 2 units per line at scale 1. */
export const ARCHIVE_GRID_HELPER_UNIT = 2;
