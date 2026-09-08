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
  const color = themeColorForRoot(root);
  const metas = [
    ...document.querySelectorAll('meta[name="theme-color"]'),
  ];
  if (!metas.length) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
    metas.push(meta);
  }
  /* Every tag, including the prefers-color-scheme copies — Safari will
     otherwise keep a stale media colour and tint the bars brand-orange. */
  for (const meta of metas) meta.setAttribute("content", color);
}
