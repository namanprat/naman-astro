/**
 * Self-check for the phone arc on `/work`.
 *   npm run test:unit
 *
 * Two things went wrong here and both are arithmetic, which is why they are
 * worth pinning: the gap between cards was set by a viewport fraction rather
 * than by the card, and the copy count that fraction produced sat one rounding
 * step away from halving the ring — which is what left the marker pointing at
 * the space between two projects.
 */
import assert from "node:assert/strict";
import {
  ringCopies,
  ringGap,
  ringRadius,
} from "../src/components/work/slider/wheelGeometry.ts";

/** `WheelView`'s phone constants and `Work.css`'s `--wheel-tile-h: 62vw`. */
const PROJECTS = 6;
const MAX_COPIES = 2;
const PITCH = 1.2;
const PHONE_SPACING_RATIO = 1.5;
const POSITIONS = PROJECTS * MAX_COPIES;
const tileFor = (w: number) => w * 0.62;

/** Narrow to wide, short to tall — the range a phone actually lands in. */
const PHONES: [number, number][] = [
  [320, 568],
  [360, 780],
  [375, 667],
  [375, 812],
  [390, 844],
  [393, 852],
  [430, 932],
];

for (const [w, h] of PHONES) {
  const tile = tileFor(w);
  const radius = ringRadius(tile, PITCH, POSITIONS);

  // The gap is a property of the card, so it reads the same on every phone.
  assert.ok(
    Math.abs(ringGap(radius, tile, POSITIONS) - tile * (PITCH - 1)) < 1e-9,
    `${w}x${h}: the anchored card clears its neighbour by ${PITCH - 1} of itself`,
  );

  // And the ring keeps all twelve positions, whatever the screen is doing.
  assert.equal(
    ringCopies(radius, PROJECTS, tile, PHONE_SPACING_RATIO, MAX_COPIES),
    MAX_COPIES,
    `${w}x${h}: ring keeps ${POSITIONS} positions`,
  );
}

/*
 * The knife edge this replaced. A radius of 0.75 × viewport height carries two
 * copies on a tall phone and one on a short one — and one copy is six positions
 * on a ring seeded for twelve, so nothing sits on the anchor.
 */
assert.equal(
  ringCopies(0.75 * 812, PROJECTS, tileFor(375), PHONE_SPACING_RATIO, MAX_COPIES),
  2,
  "the old vh radius held twelve positions on a 375x812 phone",
);
assert.equal(
  ringCopies(0.75 * 568, PROJECTS, tileFor(320), PHONE_SPACING_RATIO, MAX_COPIES),
  1,
  "...and dropped to six on a 320x568 one, which is the bug",
);

/*
 * A tile is anchored when `baseAngle(i) + rot === anchorDeg`, so seeding `rot`
 * with the anchor puts tile 0 exactly on it — for any number of positions. The
 * old seed used the desktop anchor (−90°), which is a whole number of steps
 * from the phone's 180° at twelve positions and half a step at six: aligned or
 * not depending on a rounding this file already showed to be fragile.
 */
const PHONE_ANCHOR = 180;
const DESKTOP_ANCHOR = -90;
const stepsFromAnchor = (rot: number, positions: number) =>
  (rot - PHONE_ANCHOR) / (360 / positions);

for (const positions of [POSITIONS, PROJECTS]) {
  assert.equal(
    stepsFromAnchor(PHONE_ANCHOR, positions) % 1,
    0,
    `seeding with the anchor lands on a tile at ${positions} positions`,
  );
}
assert.equal(
  stepsFromAnchor(DESKTOP_ANCHOR, PROJECTS) % 1,
  -0.5,
  "the desktop anchor parked a six-position ring half a step off",
);

console.log("wheelGeometry: all assertions passed");
