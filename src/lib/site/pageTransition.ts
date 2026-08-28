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
/** Wall-clock ceiling so a starved rAF cannot hold `go()` or the uncover. */
const FAILSAFE_MS = DURATION * 1000 + 400;
const COVERED = "is-page-covered";
const LOCKED = "is-page-transitioning";

function panelEl() {
  return document.querySelector<HTMLElement>(".transition_panel");
}

function lockScroll() {
  document.documentElement.classList.add(LOCKED);
  getSiteLenis()?.stop();
}

function unlockScroll() {
  document.documentElement.classList.remove(LOCKED, COVERED);
  getSiteLenis()?.start();
}

function markCoveredClass() {
  document.documentElement.classList.add(COVERED);
}

function parkPanel() {
  const panel = panelEl();
  if (!panel) return;
  gsap.killTweensOf(panel);
  gsap.set(panel, { pointerEvents: "none", y: 0, yPercent: 100 });
}

/**
 * Put the cover back in its CSS rest (below the viewport) and clear leave
 * bookkeeping. Browser Back restores this document from bfcache *after*
 * `animateIn` has already covered it — without this the panel sits on top
 * of the home slider with `pointer-events: all` and the next project click
 * never fires.
 */
export function resetPageTransition(): void {
  leavePending = false;
  covering = null;
  unlockScroll();
  parkPanel();
}

let historyResetInstalled = false;

function installHistoryReset() {
  if (historyResetInstalled) return;
  historyResetInstalled = true;
  window.addEventListener("pagehide", () => {
    resetPageTransition();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) resetPageTransition();
  });
}

/** `go()` has started covering; a second click should assign, not re-tween. */
let leavePending = false;
let covering: Promise<void> | null = null;

export function isLeavePending(): boolean {
  return leavePending;
}

export function markLeavePending(): void {
  leavePending = true;
}

/** Snap the panel to fully covering — used when the mobile menu is already the cover. */
export function markCovered(): void {
  const panel = panelEl();
  lockScroll();
  markCoveredClass();
  if (!panel) return;
  gsap.killTweensOf(panel);
  gsap.set(panel, { pointerEvents: "all", y: 0, yPercent: 0 });
}

function withFailsafe(run: (finish: () => void) => void): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const failsafe = window.setTimeout(finish, FAILSAFE_MS);
    run(() => {
      window.clearTimeout(failsafe);
      finish();
    });
  });
}

export function animateIn(): Promise<void> {
  if (covering) return covering;

  const panel = panelEl();
  if (!panel || prefersReducedMotion()) {
    lockScroll();
    markCoveredClass();
    covering = Promise.resolve();
    return covering;
  }

  /* Stop Lenis now so the page cannot drift under the rise. Do not add
     `is-page-transitioning` yet: overflow:hidden unsticks the home nav, and
     `is-page-covered` would CSS-snap the panel over it before this tween. */
  getSiteLenis()?.stop();
  gsap.killTweensOf(panel);

  covering = withFailsafe((finish) => {
    let locked = false;
    const lockOnce = () => {
      if (locked) return;
      locked = true;
      lockScroll();
    };

    gsap
      .timeline({
        onComplete: () => {
          lockOnce();
          finish();
        },
      })
      // y: 0 is load-bearing — without it GSAP inherits the CSS
      // `translateY(100%)` park position as `y` and yPercent stacks on top,
      // leaving the panel a full viewport below where it should be.
      .set(panel, { pointerEvents: "all", y: 0, yPercent: 100 })
      .to(panel, {
        yPercent: 0,
        duration: DURATION,
        ease: "introHop",
        onUpdate() {
          if (panel.getBoundingClientRect().top <= 0) lockOnce();
        },
      });
  });

  return covering;
}

function animateOut(): Promise<void> {
  const panel = panelEl();
  const clear = () => {
    unlockScroll();
    parkPanel();
  };
  if (!panel || prefersReducedMotion()) {
    clear();
    return Promise.resolve();
  }

  gsap.killTweensOf(panel);
  return withFailsafe((finish) => {
    gsap.fromTo(
      panel,
      { y: 0, yPercent: 0 },
      {
        yPercent: -100,
        duration: DURATION,
        ease: "introHop",
        onComplete: () => {
          clear();
          finish();
        },
      },
    );
  }).then(() => {
    /* Failsafe path skips onComplete — still park so a starved tween cannot
       leave the cover sitting on the next page. */
    if (document.documentElement.classList.contains(COVERED)) clear();
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
  installHistoryReset();

  if (isPreloading()) {
    await preloaderHandover();
    markPageRevealed();
    return;
  }

  const flagged = takeFlag(PT_COVER_KEY) === "1";
  const stuck =
    document.documentElement.classList.contains(COVERED) ||
    document.documentElement.classList.contains(LOCKED);
  if (flagged || stuck) await animateOut();
  markPageRevealed();
}
