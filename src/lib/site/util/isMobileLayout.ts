/**
 * Compact / phone layout. Mirrors the site's `(width < 48rem)` cut — the
 * inverse of `DESKTOP_NAV_MQ`.
 *
 * CSS that branches on this (grain, the heading clip-up) has to spell the
 * same query; there is no shared token for media queries.
 */
export const MOBILE_LAYOUT_MQ = "(width < 48rem)";

/** Where the chrome switches between compact mobile nav and desktop stacks. */
export const DESKTOP_NAV_MQ = "(width >= 48rem)";

export function isMobileLayout(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_LAYOUT_MQ).matches;
}
