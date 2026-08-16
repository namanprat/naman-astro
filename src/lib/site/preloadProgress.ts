/**
 * Weighted progress across the home page's boot assets.
 *
 * Progress is `Σ(value × weight) / Σ(weight)` over the *registered* segments,
 * so a segment that never registers (the About bust on mobile) redistributes
 * its share instead of capping the bar below 100.
 */

export type SegmentId = "fonts" | "grain" | "bust" | "canvas";

type Segment = { weight: number; value: number };

const segments = new Map<SegmentId, Segment>();
const listeners = new Set<(progress: number) => void>();

/** Emitted progress never goes backwards, whatever the segments report. */
let emitted = 0;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function compute(): number {
  let total = 0;
  let done = 0;
  for (const { weight, value } of segments.values()) {
    total += weight;
    done += value * weight;
  }
  return total > 0 ? done / total : 0;
}

function publish(): void {
  const next = Math.round(compute() * 100);
  if (next <= emitted) return;
  emitted = next;
  listeners.forEach((listener) => listener(emitted));
}

/** Declare a segment and its share. Must be called before any `report` for it. */
export function register(id: SegmentId, weight: number): void {
  segments.set(id, { weight, value: 0 });
}

/** Report a segment's completion in [0,1]. */
export function report(id: SegmentId, t: number): void {
  const segment = segments.get(id);
  if (!segment) return;
  segment.value = clamp01(t);
  publish();
}

/** Force every registered segment complete — the failsafe path. */
export function completeAll(): void {
  for (const segment of segments.values()) segment.value = 1;
  publish();
}

/** How many segments are in play. Denominator of the `ASSETS: n/m` readout. */
export function segmentCount(): number {
  return segments.size;
}

export function subscribe(listener: (progress: number) => void): () => void {
  listeners.add(listener);
  listener(emitted);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam — reset module state between assertions. */
export function reset(): void {
  segments.clear();
  listeners.clear();
  emitted = 0;
}
