/**
 * Palette for WebGL, where CSS custom properties can't reach.
 * Keep in sync with --light-100 / --dark-900 / --brand-500 in styles/base.css.
 */
export const SWATCH_LIGHT = "#e2e2dd";
export const SWATCH_DARK = "#1a1a1a";
/** `--dark-900` — footer/About ink black, not the fluid plate (`SWATCH_DARK`). */
export const SWATCH_BLACK = "#101010";
/**
 * `--grey` — the dark theme's liquid trail, and the fallback for both.
 *
 * The trail is a token (`--trail`) rather than the page colour inverted: the
 * invert flipped it from near-white to near-black between the themes. Dark mode
 * holds this grey; light mode takes brand black (`--dark-900`).
 */
export const SWATCH_TRAIL = "#8b8b8b";

/** `--brand-500` — About pointer trail and other accent fills. */
export const SWATCH_BRAND = "#fe522f";

export const SWATCH_LIGHT_NUM = 0xe2e2dd;
export const SWATCH_BLACK_NUM = 0x101010;

/** Desktop footer ASCII wordmark — white on light, black on dark. */
export function footerAsciiInk(themeLight: boolean): string {
  return themeLight ? SWATCH_LIGHT : SWATCH_BLACK;
}
