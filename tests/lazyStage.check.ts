/**
 * Self-check for the lazy WebGL stage gate.
 *   npm run test:unit
 *
 * The two behaviours worth pinning are the ones that cost real money when they
 * regress: `near` must latch (or scrolling past churns a GPU context on every
 * pass), and `wide` must not (or a phone keeps a context alive behind a
 * wordmark it never shows).
 */
import assert from "node:assert/strict";
import {
  INITIAL_GATE,
  nextGateState,
  shouldMount,
  type GateState,
} from "../src/lib/site/webgl/lazyStage.ts";

const enter = { type: "intersect", intersecting: true } as const;
const leave = { type: "intersect", intersecting: false } as const;

/** Runs a sequence of events from a starting state. */
function run(
  start: GateState,
  ...events: Parameters<typeof nextGateState>[1][]
) {
  return events.reduce(nextGateState, start);
}

// Nothing mounts before the box has ever been near.
assert.equal(shouldMount(INITIAL_GATE), false, "no mount before approach");

// Approaching mounts, and leaving keeps the stage but drops visibility.
{
  const near = run(INITIAL_GATE, enter);
  assert.equal(shouldMount(near), true);
  assert.equal(near.visible, true);

  const past = run(near, leave);
  assert.equal(past.visible, false, "scrolled past: park it");
  assert.equal(
    shouldMount(past),
    true,
    "but still mounted — tearing down the context costs more than parking",
  );
}

// Re-entering resumes without a second boot.
{
  const back = run(INITIAL_GATE, enter, leave, enter);
  assert.equal(back.visible, true);
  assert.equal(back.near, true, "near stays latched across the round trip");
}

// The media gate is live in both directions.
{
  const desktop: GateState = { wide: true, near: true, visible: true };
  const phone = run(desktop, { type: "media", wide: false });
  assert.equal(shouldMount(phone), false, "narrowing disposes");
  const again = run(phone, { type: "media", wide: true });
  assert.equal(shouldMount(again), true, "widening brings it back");
  assert.equal(again.near, true, "and does not re-arm the observer");
}

// A media change before the box is ever near must not mount anything.
{
  const state = run(
    { ...INITIAL_GATE, wide: false },
    { type: "media", wide: true },
  );
  assert.equal(shouldMount(state), false, "media alone is not approach");
}

console.log("lazyStage: all assertions passed");
