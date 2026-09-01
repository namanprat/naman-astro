/**
 * The ring's arithmetic, kept out of `WheelView` so it can be checked without a
 * DOM or a GSAP import — see `tests/wheelGeometry.check.ts`. Everything here is
 * pure: the class owns the measuring and the placing.
 */

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Degrees between neighbouring ring positions. */
export const ringStepDeg = (positions: number) => 360 / positions;

/**
 * Radius that leaves `tileHeight × pitch` between the anchored tile and the one
 * next to it.
 *
 * Across the anchor a single step carries a tile `r · sin(step)` along the
 * screen — the tiles further round the arc compress from there — so the radius
 * is that pitch divided by the sine.
 */
export function ringRadius(
  tileHeight: number,
  pitch: number,
  positions: number,
) {
  return (tileHeight * pitch) / Math.sin(rad(ringStepDeg(positions)));
}

/** What the reader sees between two neighbouring cards at the anchor. */
export function ringGap(
  radius: number,
  tileHeight: number,
  positions: number,
) {
  return radius * Math.sin(rad(ringStepDeg(positions))) - tileHeight;
}

/**
 * How many copies of the project list the ring can carry: each tile wants
 * `tileHeight × ratio` of arc, and the ring never runs more than `max`.
 *
 * Rounded, so the answer steps rather than slides — which is why the radius it
 * is asked about matters. Off a viewport-proportional radius this sat on the
 * boundary and a slightly shorter screen halved the positions; off
 * `ringRadius` the tile cancels out and the quotient is fixed.
 */
export function ringCopies(
  radius: number,
  projectCount: number,
  tileHeight: number,
  ratio: number,
  max: number,
) {
  if (!tileHeight || !projectCount) return 1;
  const circumference = 2 * Math.PI * radius;
  return Math.min(
    max,
    Math.max(1, Math.round(circumference / (projectCount * tileHeight * ratio))),
  );
}
