import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { syncThemeColor } from "@/lib/site/themeColor";
import "@/lib/site/eases";

/** Circle centres of the inlined switch artwork — filled-left is the dark state. */
const THEME_CX = { left: 36.3018, right: 87.4512 } as const;
const SITE_THEME_KEY = "site-theme";

/**
 * Nav + footer theme switch.
 *
 * The html class is the single source of truth, not local state: the toggle
 * writes it and every mounted instance reads it back through a MutationObserver.
 * That keeps the two switches in step with each other and with the inline
 * FOUC script, without a store between them.
 */
export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);
  const filledRef = useRef<SVGCircleElement>(null);
  const strokeRef = useRef<SVGCircleElement>(null);
  const tweenRef = useRef<gsap.core.Timeline | null>(null);
  /** Last value the circles were drawn for — null until the first paint. */
  const drawnRef = useRef<boolean | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      setIsLight(root.classList.contains("theme-light"));
      syncThemeColor(root);
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const filled = filledRef.current;
    const stroke = strokeRef.current;
    if (!filled || !stroke) return;

    const filledCx = isLight ? THEME_CX.right : THEME_CX.left;
    const strokeCx = isLight ? THEME_CX.left : THEME_CX.right;

    tweenRef.current?.kill();
    tweenRef.current = null;

    // Snap to the restored theme on first paint; only a real flip animates.
    const changed = drawnRef.current !== null && drawnRef.current !== isLight;
    drawnRef.current = isLight;

    if (!changed || prefersReducedMotion()) {
      gsap.set(filled, { attr: { cx: filledCx } });
      gsap.set(stroke, { attr: { cx: strokeCx } });
      return;
    }

    const tl = gsap.timeline();
    tl.to(filled, { attr: { cx: filledCx }, duration: 0.55, ease: "hop" }, 0);
    tl.to(stroke, { attr: { cx: strokeCx }, duration: 0.55, ease: "hop" }, 0);
    tweenRef.current = tl;
  }, [isLight]);

  const onToggle = () => {
    const next = !isLight;
    const root = document.documentElement;
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(next ? "theme-light" : "theme-dark");
    try {
      localStorage.setItem(SITE_THEME_KEY, next ? "light" : "dark");
    } catch {
      /* private mode */
    }
  };

  return (
    <button
      type="button"
      className="nav_theme_toggle"
      onClick={onToggle}
      aria-pressed={isLight}
      aria-label="Switch theme"
    >
      <span className="nav_theme_toggle_label">
        <h5 className="text-style-main">Switch theme</h5>
      </span>
      <svg
        className="nav_theme_toggle_svg"
        width="124"
        height="73"
        viewBox="0 0 124 73"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* The indicator: a filled disc that keeps its stroke, sliding between
              the two positions to mark the active side. The other stays a ring. */}
        <circle
          ref={filledRef}
          cx={THEME_CX.left}
          cy="36.3018"
          r="33.3018"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="6"
        />
        <circle
          ref={strokeRef}
          cx={THEME_CX.right}
          cy="36.3018"
          r="33.3018"
          stroke="currentColor"
          strokeWidth="6"
        />
      </svg>
    </button>
  );
}
