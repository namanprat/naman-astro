/**
 * Fixed floating scroll pill — native scrollbars can't be position:absolute and
 * still reserve layout on classic (non-overlay) systems. Hide the native bar and
 * drive a fixed thumb from window / Lenis scroll instead.
 */
import { subscribeSiteLenis } from "./lenisBridge";

const MIN_THUMB = 40;
const EDGE = 10;

/** Returns a teardown, or nothing when there was no bar to boot. */
export function bootOverlayScrollbar(): (() => void) | undefined {
  if (typeof document === "undefined") return;
  if (document.querySelector(".overlay_scrollbar")) return;

  const root = document.createElement("div");
  root.className = "overlay_scrollbar";
  root.setAttribute("aria-hidden", "true");
  const thumb = document.createElement("div");
  thumb.className = "overlay_scrollbar_thumb";
  root.appendChild(thumb);
  document.body.appendChild(root);

  let raf = 0;
  /* Geometry, refreshed only when the document or the viewport changes.
     `paint` used to read `documentElement.scrollHeight` — a forced layout — on
     every scroll frame, and it runs alongside the nav measurements, so the two
     traded invalidations back and forth. Scroll only needs `scrollY` now. */
  let maxScroll = 0;
  let maxTop = 0;

  const measure = () => {
    const scrollHeight = document.documentElement.scrollHeight;
    const view = window.innerHeight;
    maxScroll = Math.max(scrollHeight - view, 0);
    if (maxScroll <= 1) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const track = Math.max(view - EDGE * 2, 0);
    const thumbH = Math.min(
      track,
      Math.max(MIN_THUMB, (view / scrollHeight) * track),
    );
    maxTop = track - thumbH;
    thumb.style.height = `${thumbH}px`;
  };

  const paint = () => {
    raf = 0;
    if (document.documentElement.classList.contains("is-page-transitioning")) {
      root.hidden = true;
      return;
    }
    if (maxScroll <= 1) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const progress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
    thumb.style.transform = `translate3d(0, ${progress * maxTop}px, 0)`;
  };

  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(paint);
  };

  const remeasure = () => {
    measure();
    schedule();
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", remeasure);
  const ro = new ResizeObserver(remeasure);
  ro.observe(document.documentElement);

  let detachLenis: (() => void) | undefined;
  const unsubLenis = subscribeSiteLenis((lenis) => {
    detachLenis?.();
    detachLenis = lenis ? lenis.on("scroll", schedule) : undefined;
  });

  const mo = new MutationObserver(schedule);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  remeasure();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", remeasure);
    ro.disconnect();
    mo.disconnect();
    detachLenis?.();
    unsubLenis();
    root.remove();
  };
}
