/**
 * When the fluid backdrop steps, and by how much.
 *
 * Split out from `FluidSimulation` because this is the whole of what decides
 * whether a frame costs 47 full-screen GPU passes or nothing, and getting it
 * wrong fails silently — an over-eager park leaves the backdrop frozen on a
 * stale frame with no error anywhere. As a pure function of four numbers it is
 * checked in `tests/fluidPacing.check.ts` instead of by eye.
 */

/**
 * How long after the last thing that changed the picture the sim keeps stepping.
 *
 * Past it there is no dye left to advect and no colour left to converge, so a
 * step would spend its passes reproducing the frame already sitting in the
 * output target — which is the texture the scene samples either way, so parking
 * is what "keep painting the same backdrop" looks like.
 *
 * It also covers the dye's visible tail at the configured dissipation, which is
 * what `FluidSimulation.dyeActive` reports to the consumers that mask against
 * the trail.
 */
export const SETTLE_AFTER_MS = 5000;

/** Below full rate once the pointer has been still this long. */
const IDLE_AFTER_MS = 1000;
const IDLE_FRAME_MS = 1000 / 30;

/** Cappen caps here — a 1/30 step stretches the dye into spikes. */
const MAX_STEP_S = 0.016;

export type PacingInput = {
  now: number;
  /** `FluidSimulation.wake()` pushes this out whenever an input changes the picture. */
  activeUntil: number;
  lastPointerAt: number;
  /** Elapsed seconds not yet simulated. */
  pending: number;
};

/**
 * `park` drops the backlog: the sim is stopped, so accumulated time means
 * nothing and replaying it on wake would jump the dye. `hold` keeps it, so the
 * skipped time lands in the next step's `dt` and the sim evolves at the same
 * speed whichever cadence it is running at.
 */
export type Pacing =
  | { kind: "step"; dt: number }
  | { kind: "hold" }
  | { kind: "park" };

export function pace({
  now,
  activeUntil,
  lastPointerAt,
  pending,
}: PacingInput): Pacing {
  if (now > activeUntil) return { kind: "park" };
  const idle = now - lastPointerAt > IDLE_AFTER_MS;
  if (idle && pending < IDLE_FRAME_MS / 1000) return { kind: "hold" };
  return { kind: "step", dt: Math.min(pending, MAX_STEP_S) };
}
