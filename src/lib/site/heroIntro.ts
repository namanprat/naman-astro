/**
 * Page entrance: the wordmark resolves out of a gooey alpha threshold while the
 * nav copy masks up on the shared `introHop` ease.
 *
 * The wordmark melt can replay (in-page Home, a later home load). The nav
 * masks up once per tab — the first time a page becomes visible — and then
 * stays put across hard navigations. Parking it again on every route was
 * hiding labels (Archive especially) behind `overflow: clip` for the length
 * of the stagger.
 *
 * Plays at the moment the page becomes visible, which pageTransition decides:
 * straight away on a plain load, after ENTER when the preloader is up, and
 * after the cover panel finishes clearing on that first arrival.
 */
import gsap from "gsap";
import { parkLines } from "./lineMask";
import { prefersReducedMotion } from "./prefersReducedMotion";
import { PAGE_REVEALED_EVENT, isPageRevealed } from "./pageReveal";
import { readFlag, writeFlag } from "./sessionFlag";
import {
  GOOEY_BLUR_VAR,
  blurPx,
  clearGooeyBlur,
  setGooeyBlur,
  usesSoftGooey,
} from "./gooeyReveal";
import "./eases";

const GOOEY = ".name_hero_gooey";
const GOOEY_PARKED = "is-gooey-parked";
/** Opts the mark into the shared filter chain defined in `site.css`. */
const GOOEY_ARMED = "is-gooey-armed";
/**
 * The h5s, not the text inside them — `initRollingText` has already split those
 * into `.roll-char` stacks for the hover, and a second SplitText on the same
 * node corrupts it. Their `<a>` / wordmark parent is the mask.
 */
const NAV_LINES =
  ".nav_grid .nav_stack > .nav_link h5, .nav_grid .nav_contact_toggle h5, .nav_grid .nav_archive h5, .nav_grid .nav_logo_wordmark h5, .nav_grid .nav_theme_toggle_label h5";

/** Survives hard navigations in this tab; first visible page plays the nav. */
const NAV_INTRO_KEY = "nav:intro-done";

/** codegrid's timing — the melt needs the full 1.5s to read as gooey. */
const GOOEY_S = 1.5;
const NAV_S = 0.9;
const NAV_STAGGER = 0.06;

/**
 * Start radius, in em of the lockup. `.name_hero_gooey` sets `font-size` to
 * the mark's height so this is a real CSS em, not a fraction of a bbox that
 * can still be 0 when the island hydrates.
 */
const GOOEY_BLUR_EM = 0.45;

/**
 * Below the desktop nav breakpoint the mark is too small for the *threshold* to
 * read: a 0.450em blur on a small lockup is a large fraction of stroke width,
 * so the alpha threshold eats the strokes. Skip the melt; keep the lockup
 * painted.
 *
 * A design constraint, not a WebKit workaround — the separate hazard of a
 * `url()` pointing at a missing filter is handled by the `getElementById` check
 * below. Soft mode is exempt: it is blur-only, so it neither blanks nor eats
 * the mark at any size.
 */
const GOOEY_MIN_MQ = "(width >= 64rem)";

type HomeIntroSession = {
  replay: () => void;
  dispose: () => void;
};

let session: HomeIntroSession | null = null;

/**
 * The mark carries the filter chain on itself rather than on a child, unlike
 * every other gooey target: CSS applies `filter` before `mask`, so blurring the
 * masked lockup from a wrapper would blur a solid colour box and then clip it
 * with a razor-sharp mask, leaving nothing visible. `.is-gooey-armed` in
 * `site.css` is the single-element form of the same chain.
 */
function canRunGooey(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false;
  if (usesSoftGooey()) return true;
  if (!document.getElementById("blur-matrix")) return false;
  return window.matchMedia(GOOEY_MIN_MQ).matches;
}

function startBlur(gooey: HTMLElement): string {
  return blurPx(gooey, GOOEY_BLUR_EM);
}

function createSession(): HomeIntroSession {
  const gooeyEl = document.querySelector<HTMLElement>(GOOEY);
  const lines = Array.from(document.querySelectorAll<HTMLElement>(NAV_LINES));
  const gooey = canRunGooey(gooeyEl) ? gooeyEl : null;

  let tl: gsap.core.Timeline | null = null;
  let waiting = false;
  let skipNav = readFlag(NAV_INTRO_KEY) === "1";

  const settleNav = () => {
    if (!lines.length) return;
    gsap.killTweensOf(lines);
    gsap.set(lines, { yPercent: 0 });
  };

  const markNavIntroDone = () => {
    skipNav = true;
    writeFlag(NAV_INTRO_KEY, "1");
  };

  /** Final state: no filter at all, so the mark ends pixel-crisp. */
  const settle = () => {
    tl?.kill();
    tl = null;
    if (gooeyEl) {
      gsap.killTweensOf(gooeyEl);
      clearGooeyBlur(gooeyEl);
      gooeyEl.classList.remove(GOOEY_ARMED);
      gooeyEl.style.filter = "";
      gooeyEl.classList.add(GOOEY_PARKED);
    }
    settleNav();
  };

  const parkGooey = () => {
    if (!gooeyEl) return;
    gooeyEl.classList.remove(GOOEY_ARMED, GOOEY_PARKED);
    gsap.killTweensOf(gooeyEl);
    clearGooeyBlur(gooeyEl);
    gooeyEl.style.filter = "";

    if (gooey) {
      setGooeyBlur(gooey, startBlur(gooey));
      gooey.classList.add(GOOEY_ARMED, GOOEY_PARKED);
      return;
    }
    gooeyEl.classList.add(GOOEY_PARKED);
  };

  const park = (includeNav: boolean) => {
    tl?.kill();
    tl = null;
    if (includeNav && !skipNav && lines.length) {
      gsap.killTweensOf(lines);
      parkLines(lines);
    } else {
      settleNav();
    }
    parkGooey();
  };

  const play = (includeNav: boolean) => {
    waiting = false;
    tl?.kill();
    tl = gsap.timeline();
    if (gooey) {
      const from = startBlur(gooey);
      setGooeyBlur(gooey, from);
      gooey.classList.add(GOOEY_ARMED, GOOEY_PARKED);
      // fromTo so a replay cannot inherit a mid-tween 0px as the start.
      tl.fromTo(
        gooey,
        { [GOOEY_BLUR_VAR]: from },
        {
          [GOOEY_BLUR_VAR]: "0px",
          duration: GOOEY_S,
          ease: "power3.out",
          onComplete: () => {
            clearGooeyBlur(gooey);
            gooey.classList.remove(GOOEY_ARMED);
          },
        },
      );
    } else if (gooeyEl) {
      gooeyEl.classList.add(GOOEY_PARKED);
    }
    if (includeNav && !skipNav && lines.length) {
      markNavIntroDone();
      tl.to(
        lines,
        {
          yPercent: 0,
          duration: NAV_S,
          ease: "introHop",
          stagger: NAV_STAGGER,
        },
        gooey ? 0.15 : 0,
      );
    } else {
      settleNav();
    }
  };

  const onReveal = () => {
    play(!skipNav);
  };

  const armWait = () => {
    if (waiting) return;
    waiting = true;
    window.addEventListener(PAGE_REVEALED_EVENT, onReveal, { once: true });
  };

  const replay = () => {
    if (prefersReducedMotion()) {
      settle();
      markNavIntroDone();
      return;
    }
    window.removeEventListener(PAGE_REVEALED_EVENT, onReveal);
    waiting = false;
    park(false);
    if (isPageRevealed()) {
      play(false);
      return;
    }
    armWait();
  };

  const dispose = () => {
    window.removeEventListener(PAGE_REVEALED_EVENT, onReveal);
    waiting = false;
    settle();
  };

  if (prefersReducedMotion()) {
    settle();
    markNavIntroDone();
    return { replay: settle, dispose };
  }

  park(!skipNav);
  if (isPageRevealed()) play(!skipNav);
  else armWait();

  return { replay, dispose };
}

/** Parks the melt at `0.450em` and plays once the page is visible. */
export function bootHomeIntro(): () => void {
  session?.dispose();
  session = createSession();
  return () => {
    if (session) {
      session.dispose();
      session = null;
    }
  };
}

/**
 * Restart the homepage wordmark from `0.450em`. The nav is left where it is.
 * Safe to call when already on `/` (chrome does not remount) and a no-op if
 * intro has not booted yet.
 */
export function replayHomeIntro(): void {
  session?.replay();
}
