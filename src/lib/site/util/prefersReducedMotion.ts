/** Exported for callers that need the live `MediaQueryList` to subscribe to. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Shared reduced-motion check — the same query pageTransition and rollingText use. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}
