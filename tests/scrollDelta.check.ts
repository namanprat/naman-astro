/**
 * `scrollDelta` sign + axis conventions.
 *
 * The axis half is the load-bearing one: a sideways trackpad swipe is the
 * browser's back/forward gesture, so a wheel must contribute nothing from
 * `deltaX`. Touch keeps the dominant axis — a finger swiping a gallery
 * sideways does mean "advance".
 */
import assert from "node:assert/strict";
import type { Observer } from "gsap/Observer";
import { scrollDelta } from "../src/components/work/slider/scrollDelta.ts";

/** Just the four fields `scrollDelta` reads. */
function observer(
  deltaX: number,
  deltaY: number,
  type: "wheel" | "touchmove",
): Observer {
  return { deltaX, deltaY, event: { type } } as unknown as Observer;
}

assert.equal(
  scrollDelta(observer(100, 0, "wheel")),
  0,
  "a sideways trackpad swipe is not slider input",
);

assert.equal(
  scrollDelta(observer(300, 12, "wheel")),
  12,
  "a diagonal wheel contributes only its vertical part",
);

assert.equal(
  scrollDelta(observer(0, 40, "wheel")),
  40,
  "a vertical wheel is unchanged, in wheel space",
);

assert.equal(
  scrollDelta(observer(0, 40, "touchmove")),
  -40,
  "touch still flips into wheel space",
);

assert.equal(
  scrollDelta(observer(40, 5, "touchmove")),
  -40,
  "touch still takes the dominant axis",
);

console.log("scrollDelta.check: ok");
