/**
 * Safari (and other) browser chrome colour. Must match `--background` in
 * `styles/base.css` (`--light-100` / `--dark-900`) so the page paints through
 * the Dynamic Island and the home-indicator band under `viewport-fit=cover`.
 */
export const THEME_COLOR_LIGHT = "#e2e2dd";
export const THEME_COLOR_DARK = "#101010";

export function themeColorForRoot(
  root: HTMLElement = document.documentElement,
): string {
  return root.classList.contains("theme-light")
    ? THEME_COLOR_LIGHT
    : THEME_COLOR_DARK;
}

/** Keep `<meta name="theme-color">` in lockstep with the html theme class. */
export function syncThemeColor(): void {
  if (typeof document === "undefined") return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = themeColorForRoot();
}
