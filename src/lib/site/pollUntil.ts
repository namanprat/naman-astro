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
