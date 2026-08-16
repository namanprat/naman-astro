/**
 * Render settings for the footer ASCII wordmark.
 *
 * Was a leva panel; the panel was hidden in production and these are the values
 * it was tuned to, so the whole dependency was shipping to render constants.
 *
 * Charset sticks to Duforn Mono's subset — no `:`, `+`, `%`, `@`.
 */

export type AsciiControls = {
  fontSize: number;
  cellSize: number;
  charset: string;
  custom: string;
  scrambleMs: number;
};

export const DEFAULT_ASCII_CHARSET = ".*#0369";

const DESKTOP: AsciiControls = {
  fontSize: 13,
  cellSize: 6,
  charset: DEFAULT_ASCII_CHARSET,
  custom: "",
  scrambleMs: 50,
};

const MOBILE: AsciiControls = { ...DESKTOP, fontSize: 5, cellSize: 3 };

export function useAsciiControls(): AsciiControls {
  // ponytail: read once at mount, as the leva version was. A resize across the
  // 640px line keeps the size it booted with; upgrade to a matchMedia listener
  // if that ever reads wrong.
  return typeof window !== "undefined" && window.innerWidth < 640
    ? MOBILE
    : DESKTOP;
}
