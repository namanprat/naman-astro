/**
 * Single-panel page transition: one full-screen block rises from the bottom to
 * cover the departing page, then keeps travelling up and off the top of the
 * arriving one. Scroll is locked and a loading cue shows while covered.
 * ponytail: hard nav + sessionStorage FOUC flag, no ClientRouter.
 */
import gsap from "gsap";
import { getSiteLenis } from "./lenisBridge";
import {
  isPreloading,
  markPageRevealed,
  PRELOAD_ENTERED_EVENT,
} from "./pageReveal";
import { prefersReducedMotion } from "./prefersReducedMotion";
import { takeFlag } from "./sessionFlag";
import "./eases";

export const PT_COVER_KEY = "pt:cover";

const DURATION = 0.9;

function panelEl() {
  return document.querySelector<HTMLElement>(".transition_panel");
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
export function markCovered(): void {
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

function animateOut(): Promise<void> {
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
 * Resolves when the home preloader hands the screen over.
 *
 * Two signals, either of which is enough. The event is the intended one; the
 * class going away is the state itself, watched as well because this promise
 * gates the entire page entrance — the hero nav, the heading gooey and the line
 * reveal all wait behind it, and the two hold classes in `site.css` keep every
 * heading and paragraph at `visibility: hidden` until the modules that clear
 * them have booted. A dispatch that goes missing therefore hides the whole page
 * for the session rather than merely skipping an animation, which is exactly
 * what happened when the dispatch was deleted and the listener was left behind.
 */
function preloaderHandover(): Promise<void> {
  return new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (!isPreloading()) done();
    });

    function done() {
      observer.disconnect();
      window.removeEventListener(PRELOAD_ENTERED_EVENT, done);
      resolve();
    }

    window.addEventListener(PRELOAD_ENTERED_EVENT, done);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  });
}

/**
 * Call on every page load: uncover if we arrived mid-transition.
 *
 * When the home preloader is up it owns the screen instead, so resolve only
 * once the visitor hits ENTER — that keeps the caller's line-reveal entrance
 * from playing behind the overlay.
 */
export async function bootIfCovered(): Promise<void> {
  if (isPreloading()) {
    await preloaderHandover();
    markPageRevealed();
    return;
  }

  // Plain load: nothing is hiding the page, so it is already revealed.
  if (takeFlag(PT_COVER_KEY) === "1") await animateOut();
  markPageRevealed();
}
