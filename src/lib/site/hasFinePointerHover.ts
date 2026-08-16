import { prefersReducedMotion } from "./prefersReducedMotion";

/** True when a fine pointer can hover (desktop mouse/trackpad). */
export function hasFinePointerHover(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia("(hover: hover)").matches) return false;
  if (!window.matchMedia("(pointer: fine)").matches) return false;
  if (prefersReducedMotion()) return false;
  return true;
}
