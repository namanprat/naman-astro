/**
 * Safari / in-app chrome colour. Keep in sync with --dark-900 / --light-100.
 * Archive is always the dark bar, even if the visitor has light theme stored.
 */
export const THEME_COLOR_DARK = "#101010";
export const THEME_COLOR_LIGHT = "#e2e2dd";

export function themeColorForRoot(
  root: HTMLElement = document.documentElement,
): string {
  if (root.classList.contains("page-archive")) return THEME_COLOR_DARK;
  if (root.classList.contains("theme-light")) return THEME_COLOR_LIGHT;
  return THEME_COLOR_DARK;
}

export function syncThemeColor(
  root: HTMLElement = document.documentElement,
): void {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", themeColorForRoot(root));
}
