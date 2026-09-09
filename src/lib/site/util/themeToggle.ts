import gsap from "gsap";
import { prefersReducedMotion } from "./prefersReducedMotion";
import { syncThemeColor } from "./themeColor";
import "./eases";

/** Circle centres of the inlined switch artwork — filled-left is the dark state. */
const THEME_CX = { left: 36.3018, right: 87.4512 } as const;
const SITE_THEME_KEY = "site-theme";

function isLightTheme(root: HTMLElement = document.documentElement): boolean {
  return root.classList.contains("theme-light");
}

function setTheme(light: boolean): void {
  const root = document.documentElement;
  root.classList.remove("theme-dark", "theme-light");
  root.classList.add(light ? "theme-light" : "theme-dark");
  try {
    localStorage.setItem(SITE_THEME_KEY, light ? "light" : "dark");
  } catch {
    /* private mode */
  }
}

function paintToggle(button: HTMLButtonElement, light: boolean, animate: boolean): void {
  const filled = button.querySelector<SVGCircleElement>("[data-theme-filled]");
  const stroke = button.querySelector<SVGCircleElement>("[data-theme-stroke]");
  if (!filled || !stroke) return;

  const filledCx = light ? THEME_CX.right : THEME_CX.left;
  const strokeCx = light ? THEME_CX.left : THEME_CX.right;
  const drawn = button.dataset.themeDrawn;
  button.dataset.themeDrawn = light ? "light" : "dark";
  button.setAttribute("aria-pressed", String(light));

  const changed = drawn !== undefined && drawn !== (light ? "light" : "dark");
  if (!changed || !animate || prefersReducedMotion()) {
    gsap.set(filled, { attr: { cx: filledCx } });
    gsap.set(stroke, { attr: { cx: strokeCx } });
    return;
  }

  gsap.to(filled, { attr: { cx: filledCx }, duration: 0.55, ease: "hop" });
  gsap.to(stroke, { attr: { cx: strokeCx }, duration: 0.55, ease: "hop" });
}

/**
 * Bind every `.nav_theme_toggle`. The html class is the source of truth; each
 * button reads it back through a MutationObserver so the two switches stay in
 * step with each other and with the inline FOUC script.
 */
export function bootThemeToggles(root: ParentNode = document): void {
  const buttons = [
    ...root.querySelectorAll<HTMLButtonElement>(".nav_theme_toggle"),
  ];
  if (!buttons.length) return;

  const sync = () => {
    const light = isLightTheme();
    syncThemeColor();
    for (const button of buttons) paintToggle(button, light, true);
  };

  for (const button of buttons) {
    paintToggle(button, isLightTheme(), false);
    button.addEventListener("click", () => setTheme(!isLightTheme()));
  }

  const mo = new MutationObserver(sync);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}
