import { prefersReducedMotion } from "./prefersReducedMotion";

/** Exported for callers that need the live `MediaQueryList` to subscribe to. */
export const FINE_HOVER_QUERY = "(hover: hover) and (pointer: fine)";

/** True when a fine pointer can hover (desktop mouse/trackpad). */
export function hasFinePointerHover(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia(FINE_HOVER_QUERY).matches) return false;
  if (prefersReducedMotion()) return false;
  return true;
}
