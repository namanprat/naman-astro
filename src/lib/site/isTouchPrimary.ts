/**
 * Touch is the primary pointer — phones and iPads, not mouse laptops.
 *
 * ponytail: width ≠ input. Layout still keys off `(width < 48rem)`, but an
 * iPad at 820px is a desktop layout with a finger. iPadOS desktop-mode Safari
 * can also look like a Macintosh in the UA, so this never trusts the UA —
 * `(hover: none) and (pointer: coarse)` is the capability check.
 */
export const TOUCH_PRIMARY_MQ = "(hover: none) and (pointer: coarse)";

export function isTouchPrimary(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(TOUCH_PRIMARY_MQ).matches;
}
