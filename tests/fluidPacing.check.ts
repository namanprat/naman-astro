/**
 * Self-check for the fluid backdrop's frame pacing.
 *   npm run test:unit
 *
 * The expensive branch is `step` — 47 full-screen GPU passes — so every
 * assertion here is really about which inputs are allowed to reach it.
 */
import assert from "node:assert/strict";
import { pace, SETTLE_AFTER_MS } from "../src/lib/site/fluid/fluidPacing.ts";

/**
 * A pointer moving right now, mid-trail: the full-rate case.
 *
 * `pending` is deliberately under the max step. A real 60Hz frame is 0.0167s,
 * which is over Cappen's 0.016 cap — so at full rate the cap is always what
 * lands, and a case built on 1/60 could not tell "stepped at the frame delta"
 * apart from "clamped".
 */
const active = {
  now: 10_000,
  activeUntil: 10_000 + SETTLE_AFTER_MS,
  lastPointerAt: 10_000,
  pending: 0.01,
};

assert.deepEqual(
  pace(active),
  { kind: "step", dt: 0.01 },
  "a live pointer steps at the frame's own delta",
);

// A long frame is capped rather than stretched, or the dye spikes.
assert.deepEqual(
  pace({ ...active, pending: 0.5 }),
  { kind: "step", dt: 0.016 },
  "a long frame clamps to the max step",
);

// Past the settle window nothing is moving, so the frame is free.
assert.deepEqual(
  pace({ ...active, now: active.activeUntil + 1 }),
  { kind: "park" },
  "past activeUntil the sim parks",
);

// The boundary itself belongs to the active side, so a wake landing exactly on
// a frame is not dropped by it.
assert.deepEqual(
  pace({
    ...active,
    now: active.activeUntil,
    lastPointerAt: active.activeUntil,
  }),
  { kind: "step", dt: active.pending },
  "the settle boundary still steps",
);

// A stale pointer inside the settle window is the dye's tail dissipating: it
// still has to be advected, just not 60 times a second.
const idle = { ...active, lastPointerAt: active.now - 4000 };
assert.deepEqual(
  pace({ ...idle, pending: 1 / 60 }),
  { kind: "hold" },
  "an idle frame under the idle budget holds",
);
assert.deepEqual(
  pace({ ...idle, pending: 1 / 30 }),
  { kind: "step", dt: 0.016 },
  "an idle frame steps once the held time reaches the idle cadence",
);

// Parking outranks the idle throttle: `hold` keeps the backlog for a step that
// is still coming, and past the settle window no step is coming.
assert.deepEqual(
  pace({ ...idle, now: active.activeUntil + 1, pending: 0 }),
  { kind: "park" },
  "a settled idle frame parks rather than holding a backlog forever",
);

// The touch-primary case: `onPointerMove` returns before it records anything
// when the trail is gated off, so `lastPointerAt` and `activeUntil` both stay
// at their initial 0 and every frame past the opening wake must be free.
assert.deepEqual(
  pace({ now: 60_000, activeUntil: SETTLE_AFTER_MS, lastPointerAt: 0, pending: 0.4 }),
  { kind: "park" },
  "a page that never splats parks once its opening wake expires",
);

console.log("fluidPacing: all assertions passed");
