/**
 * Self-check for gallery scroll sign normalisation.
 *   npm run test:unit
 *
 * Wheel and drag report opposite signs for the same intent. Both engines take
 * this helper; pinning it here is what keeps them from drifting apart again.
 */
import assert from "node:assert/strict";
import { scrollDelta } from "../src/components/work/slider/scrollDelta.ts";
import type { Observer } from "gsap/Observer";

const asObserver = (
  partial: Pick<Observer, "deltaX" | "deltaY"> & {
    event?: { type: string } | null;
  },
) => partial as Observer;

assert.equal(
  scrollDelta(asObserver({ deltaX: 0, deltaY: 40, event: { type: "wheel" } })),
  40,
  "wheel down stays positive",
);

assert.equal(
  scrollDelta(
    asObserver({ deltaX: 0, deltaY: 40, event: { type: "touchmove" } }),
  ),
  -40,
  "finger-down drag flips into wheel space",
);

assert.equal(
  scrollDelta(
    asObserver({ deltaX: 0, deltaY: 40, event: { type: "pointermove" } }),
  ),
  -40,
  "iPad pointermove drag flips the same way as touchmove",
);

assert.equal(
  scrollDelta(asObserver({ deltaX: 50, deltaY: 10, event: { type: "wheel" } })),
  50,
  "dominant axis wins on a diagonal wheel",
);

assert.equal(
  scrollDelta(asObserver({ deltaX: 0, deltaY: -30, event: null })),
  30,
  "missing event type is treated as a drag (safer invert)",
);

console.log("scrollDelta: all assertions passed");
