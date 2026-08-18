/**
 * Single-panel page transition: one full-screen block rises from the bottom to
 * cover the departing page, then keeps travelling up and off the top of the
 * arriving one. Scroll is locked and a loading cue shows while covered.
 * ponytail: hard nav + sessionStorage FOUC flag, no ClientRouter.
 */
import gsap from "gsap";
import { getSiteLenis } from "./lenisBridge";
import { markPageRevealed } from "./pageReveal";
import { prefersReducedMotion } from "./prefersReducedMotion";
import "./eases";

export const PT_COVER_KEY = "pt:cover";

const DURATION = 0.9;

function panelEl() {
  return document.querySelector<HTMLElement>(".transition-panel");
}

function lockScroll() {
  document.documentElement.classList.add("is-page-transitioning");
  getSiteLenis()?.stop();
}

function unlockScroll() {
  document.documentElement.classList.remove("is-page-transitioning");
  getSiteLenis()?.start();
}

/** Snap the panel to fully covering — used when the mobile menu is already the cover. */
export function markCovered() {
  const panel = panelEl();
  lockScroll();
  if (!panel) return;
  gsap.set(panel, { pointerEvents: "all", y: 0, yPercent: 0 });
}

export function animateIn(): Promise<void> {
  const panel = panelEl();
  lockScroll();
  if (!panel || prefersReducedMotion()) return Promise.resolve();

  return new Promise((resolve) => {
    gsap
      .timeline({ onComplete: resolve })
      // y: 0 is load-bearing — without it GSAP inherits the CSS
      // `translateY(100%)` park position as `y` and yPercent stacks on top,
      // leaving the panel a full viewport below where it should be.
      .set(panel, { pointerEvents: "all", y: 0, yPercent: 100 })
      .to(panel, { yPercent: 0, duration: DURATION, ease: "introHop" });
  });
}

export function animateOut(): Promise<void> {
  const panel = panelEl();
  const clear = () => {
    unlockScroll();
    if (panel) gsap.set(panel, { pointerEvents: "none" });
  };
  if (!panel || prefersReducedMotion()) {
    clear();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    gsap.fromTo(
      panel,
      { y: 0, yPercent: 0 },
      {
        yPercent: -100,
        duration: DURATION,
        ease: "introHop",
        onComplete: () => {
          clear();
          resolve();
        },
      },
    );
  });
}

/**
 * Call on every page load: uncover if we arrived mid-transition.
 *
 * When the home preloader is up it owns the screen instead, so resolve only
 * once the visitor hits ENTER — that keeps the caller's line-reveal entrance
 * from playing behind the overlay.
 */
export function bootIfCovered(): Promise<void> {
  if (document.documentElement.classList.contains("is-preloading")) {
    return new Promise<void>((resolve) =>
      window.addEventListener("site:preload-entered", () => resolve(), {
        once: true,
      }),
    ).then(markPageRevealed);
  }

  let covered = false;
  try {
    covered = sessionStorage.getItem(PT_COVER_KEY) === "1";
    if (covered) sessionStorage.removeItem(PT_COVER_KEY);
  } catch {
    covered = false;
  }

  // Plain load: nothing is hiding the page, so it is already revealed.
  if (!covered) {
    markPageRevealed();
    return Promise.resolve();
  }
  return animateOut().then(markPageRevealed);
}
