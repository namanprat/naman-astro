/**
 * Ordered per-frame callbacks, and which one owns the draw.
 *
 * This is the half of `useFrame` that has nothing to do with React, split out
 * so it can be checked in `tests/frameBus.check.ts`. The ordering is not a
 * detail: the hero stacks four subscribers on one canvas and every one of them
 * reads state the previous one wrote —
 *
 *   -3  camera view offset, logo spin   (where the glass *is* this frame)
 *   -1  fluid step, ASCII matte pass    (what the glass refracts and masks)
 *    0  wordmark, trail overlay         (screen-space reads of both)
 *
 * — so running them out of order does not throw, it shears the glyphs off the
 * glass by one frame. That is invisible in a diff and hard to spot in motion,
 * which is why the contract is a tested pure function rather than a convention.
 *
 * ponytail: an explicit `setRender`, where R3F infers the same thing from a
 * positive priority. R3F's rule is that any `useFrame` with `priority > 0`
 * silently disables the automatic render and makes *that* callback responsible
 * for drawing — which is how `AsciiField` takes over (it renders the subject to
 * an offscreen target, then the glyph grid to the screen). Inferring it from a
 * number means the draw disappears when someone reorders a priority for an
 * unrelated reason. Naming it costs one line at the one call site that needs it.
 */

export type FrameCallback = (dt: number, elapsed: number) => void;

type Entry = {
  fn: FrameCallback;
  priority: number;
  /** Insertion order, so equal priorities keep the order they subscribed in. */
  seq: number;
};

export type FrameBus = {
  /** Returns an unsubscribe. Safe to call from inside a callback. */
  add(fn: FrameCallback, priority?: number): () => void;
  /**
   * Take the draw away from the stage's default `render(scene, camera)`.
   * Pass `null` to give it back.
   */
  setRender(fn: (() => void) | null): void;
  /** What the stage should call after `run` — its own render, or the override. */
  readonly render: (() => void) | null;
  /** Runs every callback in priority order. */
  run(dt: number, elapsed: number): void;
  readonly size: number;
  clear(): void;
};

export function createFrameBus(): FrameBus {
  const entries: Entry[] = [];
  let seq = 0;
  let sorted = true;
  let override: (() => void) | null = null;

  return {
    add(fn, priority = 0) {
      const entry: Entry = { fn, priority, seq: seq++ };
      entries.push(entry);
      sorted = false;
      let live = true;
      return () => {
        // Idempotent: a stage's dispose and a component's own teardown both
        // call this, and the second one must not evict a later subscriber that
        // happens to sit at the same index.
        if (!live) return;
        live = false;
        const at = entries.indexOf(entry);
        if (at !== -1) entries.splice(at, 1);
      };
    },

    setRender(fn) {
      override = fn;
    },

    get render() {
      return override;
    },

    run(dt, elapsed) {
      if (!sorted) {
        entries.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
        sorted = true;
      }
      // ponytail: iterate a copy. Callbacks unsubscribe themselves (the hero's
      // intro cues do, once they have run), and splicing the array being walked
      // skips whichever subscriber shuffled into the vacated index.
      for (const entry of entries.slice()) entry.fn(dt, elapsed);
    },

    get size() {
      return entries.length;
    },

    clear() {
      entries.length = 0;
      override = null;
    },
  };
}
