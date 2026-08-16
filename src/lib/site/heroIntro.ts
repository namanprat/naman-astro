/**
 * Page entrance: the wordmark resolves out of a gooey alpha threshold while the
 * nav copy masks up on the shared `introHop` ease.
 *
 * Plays at the moment the page becomes visible, which pageTransition decides:
 * straight away on a plain load, after ENTER when the preloader is up, and
 * after the cover panel finishes clearing when arriving from another page.
 */
import gsap from "gsap";
import CustomEase from "gsap/CustomEase";
import { prefersReducedMotion } from "./prefersReducedMotion";
import { PAGE_REVEALED_EVENT, isPageRevealed } from "./pageReveal";
import { gooeyFilter } from "./gooeyReveal";

gsap.registerPlugin(CustomEase);
CustomEase.create("introHop", "0.9, 0, 0.1, 1");

const GOOEY = ".name-hero__gooey";
const GOOEY_PARKED = "is-gooey-parked";
/**
 * The h5s, not the text inside them — `initRollingText` has already split those
 * into `.roll-char` stacks for the hover, and a second SplitText on the same
 * node corrupts it. Their `<a>` / wordmark parent is the mask.
 */
const NAV_LINES =
  ".nav_grid .nav-stack > .nav-link h5, .nav_grid .nav-contact-toggle h5, .nav_grid .nav-archive h5, .nav_grid .nav-logo-wordmark h5";

/** codegrid's timing — the melt needs the full 1.5s to read as gooey. */
const GOOEY_S = 1.5;
const NAV_S = 0.9;
const NAV_STAGGER = 0.06;

/**
 * Blur as a fraction of the wordmark's height. codegrid parks at `0.35em`,
 * which works there because the blur sits on real type and scales with it; the
 * lockup is a masked shape with no font-size, so this scales off the mark.
 * Much above this and the threshold eats the thin strokes entirely.
 */
const GOOEY_BLUR_RATIO = 0.1125;

/**
 * Below the desktop nav breakpoint the mark is too small: a 4px+ blur plus the
 * alpha threshold eats the strokes, and `filter: url(#blur-matrix)` on WebKit
 * can vanish the element entirely. Skip the melt; keep the lockup painted.
 */
const GOOEY_MIN_MQ = "(width >= 64rem)";

/**
 * `gooeyFilter` comes from gooeyReveal — the blur-before-threshold ordering is
 * the same rule there. The wordmark is the one place it goes on a single
 * element rather than the two-layer split: CSS applies `filter` before `mask`,
 * so blurring the masked lockup itself would blur a solid colour box and then
 * clip it with a razor-sharp mask, leaving nothing visible.
 */
function canRunGooey(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false;
  if (!document.getElementById("blur-matrix")) return false;
  return window.matchMedia(GOOEY_MIN_MQ).matches;
}

export function bootHomeIntro(): () => void {
  const gooeyEl = document.querySelector<HTMLElement>(GOOEY);
  const lines = Array.from(document.querySelectorAll<HTMLElement>(NAV_LINES));
  if (!gooeyEl && !lines.length) return () => {};

  const gooey = canRunGooey(gooeyEl) ? gooeyEl : null;
  const startBlur = gooey
    ? Math.max(4, gooey.getBoundingClientRect().height * GOOEY_BLUR_RATIO)
    : 0;

  /** Final state: no filter at all, so the mark ends pixel-crisp. */
  const settle = () => {
    if (gooeyEl) {
      gooeyEl.style.filter = "";
      gooeyEl.classList.add(GOOEY_PARKED);
    }
    if (lines.length) gsap.set(lines, { yPercent: 0 });
  };

  if (prefersReducedMotion()) {
    settle();
    return () => {};
  }

  if (lines.length) gsap.set(lines, { yPercent: 110 });

  // Park the melt immediately so the sharp lockup never paints. A leftover
  // url() filter on WebKit (killed timeline, missing #blur-matrix) leaves the
  // mark invisible — only apply it when canRunGooey is true, and always clear
  // it in settle / onComplete.
  if (gooey) {
    gooey.style.filter = gooeyFilter(startBlur);
    gooey.classList.add(GOOEY_PARKED);
  }

  let tl: gsap.core.Timeline | null = null;

  const play = () => {
    tl = gsap.timeline();
    if (gooey) {
      const state = { blur: startBlur };
      tl.to(state, {
        blur: 0,
        duration: GOOEY_S,
        ease: "power3.out",
        onUpdate: () => {
          gooey.style.filter = gooeyFilter(state.blur);
        },
        onComplete: () => {
          gooey.style.filter = "";
        },
      });
    } else if (gooeyEl) {
      gooeyEl.classList.add(GOOEY_PARKED);
    }
    if (lines.length) {
      tl.to(
        lines,
        {
          yPercent: 0,
          duration: NAV_S,
          ease: "introHop",
          stagger: NAV_STAGGER,
        },
        // Overlap the nav under the melt so it reads as one arrival.
        gooey ? 0.15 : 0,
      );
    }
  };

  const dispose = () => {
    window.removeEventListener(PAGE_REVEALED_EVENT, play);
    tl?.kill();
    settle();
  };

  // The reveal can be marked before this island hydrates, so check the flag
  // as well as listening for the event.
  if (isPageRevealed()) {
    play();
    return dispose;
  }

  window.addEventListener(PAGE_REVEALED_EVENT, play, { once: true });
  return dispose;
}
