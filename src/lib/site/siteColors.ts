/**
 * Palette for WebGL, where CSS custom properties can't reach.
 * Keep in sync with --light-100 / --dark-900 / --brand-500 in styles/base.css.
 */
export const SWATCH_LIGHT = "#e2e2dd";
export const SWATCH_DARK = "#1a1a1a";
/** `--dark-900` — footer/About ink black, not the fluid plate (`SWATCH_DARK`). */
export const SWATCH_BLACK = "#101010";
/** `--brand-500` — About pointer trail and other accent fills. */
export const SWATCH_BRAND = "#ec4d2d";

export const SWATCH_LIGHT_NUM = 0xe2e2dd;
export const SWATCH_BLACK_NUM = 0x101010;

/** Desktop footer ASCII wordmark — white on light, black on dark. */
export function footerAsciiInk(themeLight: boolean): string {
  return themeLight ? SWATCH_LIGHT : SWATCH_BLACK;
}
