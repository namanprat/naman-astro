/**
 * Render settings for the About model canvas.
 *
 * Was a leva panel; the panel was hidden in production and these are the values
 * it was tuned to, so the whole dependency was shipping to render constants.
 */
export const ABOUT_CANVAS = {
  // Dither
  gridSize: 4,
  pixelSizeRatio: 1,
  grayscaleOnly: true,
  invertColor: false,
  // Model
  bustScale: 5,
  bustY: 0,
  spinSpeed: 0.35,
  // Light
  highlight: "#066aff",
  envIntensity: 1.5,
} as const;
