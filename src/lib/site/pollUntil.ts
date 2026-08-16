/**
 * Poll `query` until it yields something, or the deadline passes.
 *
 * Its own file, with no imports, so `scripts/line-reveal.test.ts` can exercise
 * the shipped loop under node — pulling it out of lineReveal.ts would drag gsap
 * and a DOM in with it.
 */

/** Injected in tests; the real clock only advances in a browser. */
type Clock = {
  now: () => number;
  wait: (ms: number) => Promise<void>;
};

const realClock: Clock = {
  now: () => performance.now(),
  wait: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export async function pollUntil<T>(
  query: () => T[],
  { deadline, intervalMs }: { deadline: number; intervalMs: number },
  clock: Clock = realClock,
): Promise<T[]> {
  for (;;) {
    const found = query();
    if (found.length || clock.now() >= deadline) return found;
    await clock.wait(intervalMs);
  }
}
