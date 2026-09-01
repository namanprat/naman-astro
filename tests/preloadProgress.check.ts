/**
 * Self-check for the weighted progress math.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import {
  register,
  report,
  reset,
  segmentCount,
  subscribe,
} from "../src/lib/site/preloadProgress.ts";

function latest(): number {
  let value = -1;
  subscribe((n) => {
    value = n;
  })();
  return value;
}

// All segments present: weights sum to 100.
reset();
register("fonts", 10);
register("grain", 20);
register("canvas", 20);
register("bust", 50);
report("bust", 1);
assert.equal(latest(), 50, "bust alone is half the bar");
report("fonts", 1);
report("grain", 1);
report("canvas", 1);
assert.equal(latest(), 100, "everything in reaches 100");

// Bust skipped (mobile): the remaining 50 units of weight must still reach 100.
reset();
register("fonts", 10);
register("grain", 20);
register("canvas", 20);
report("fonts", 1);
report("grain", 1);
report("canvas", 1);
assert.equal(latest(), 100, "a skipped segment redistributes its share");

// Monotonic: a segment reporting backwards must not drag the bar down.
reset();
register("grain", 1);
report("grain", 0.8);
assert.equal(latest(), 80);
report("grain", 0.2);
assert.equal(latest(), 80, "progress never goes backwards");

// Out-of-range values clamp.
reset();
register("grain", 1);
report("grain", 5);
assert.equal(latest(), 100, "values above 1 clamp");
reset();
register("grain", 1);
report("grain", -3);
assert.equal(latest(), 0, "values below 0 clamp");

// segmentCount() is the denominator of the `ASSETS: n/m` readout, and must
// reflect only what actually registered.
reset();
register("fonts", 10);
register("grain", 20);
assert.equal(segmentCount(), 2, "skipped segments are not counted");

// Unregistered ids are ignored rather than throwing.
reset();
register("fonts", 1);
report("bust", 1);
assert.equal(latest(), 0, "reporting an unregistered segment is a no-op");

// Process models are a real home-boot segment; they share the bar with the rest.
reset();
register("fonts", 10);
register("grain", 20);
register("canvas", 20);
register("process", 20);
report("process", 1);
assert.equal(latest(), 29, "process alone is 20/70 of the bar");
report("fonts", 1);
report("grain", 1);
report("canvas", 1);
assert.equal(latest(), 100, "process plus the rest reaches 100");

console.log("preloadProgress: all assertions passed");
