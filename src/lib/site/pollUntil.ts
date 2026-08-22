/**
 * Text must never stay hidden because fonts, an island, or SplitText failed —
 * past this deadline the page just shows, unanimated.
 *
 * A flat budget, not per-stage timeouts: if a page ever needs longer, raise
 * this one number rather than adding stages. `lineReveal` and `gooeyReveal`
 * have to expire together or one reveals while the other is still waiting, so
 * they read it from here instead of each declaring their own.
 */
export const REVEAL_FAILSAFE_MS = 2000;

/** How often to re-check for island copy while inside the budget. */
export const REVEAL_POLL_MS = 50;

/**
 * Poll `query` until it yields something, or the deadline passes.
 */
export async function pollUntil<T>(
  query: () => T[],
  { deadline, intervalMs }: { deadline: number; intervalMs: number },
): Promise<T[]> {
  for (;;) {
    const found = query();
    if (found.length || performance.now() >= deadline) return found;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
