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

/** Set while a WebGL surface owns the mark, so `Menu.css` can stop painting the
 *  DOM lockup without taking it out of layout or the a11y tree. */
const WEBGL_CLASS = "is-hero-webgl";

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
  /** Drop the DOM mark's filter when a WebGL surface takes the wordmark over. */
  releaseDomWordmark: () => void;
};

let session: HomeIntroSession | null = null;

/* ── Wordmark cue channel ──────────────────────────────────────────────────
 *
 * The glass hero renders the wordmark inside its own scene — that is the only
 * way `MeshTransmissionMaterial` can refract it, since transmission samples the
 * WebGL scene and never the DOM. The melt has to go with it.
 *
 * This module stays the single owner of *when*: it holds `PAGE_REVEALED_EVENT`,
 * the once-per-tab nav flag, the reduced-motion bail and `replayHomeIntro`. A
 * WebGL surface subscribes and gets told what to be doing; it decides how to
 * paint it.
 *
 * `startedAt` is why a cue is a value rather than a callback. The surface is a
 * lazy chunk behind a GLB fetch, so it can subscribe mid-melt or after it —
 * carrying the start time lets it seek its own tween to the right frame instead
 * of restarting the entrance under the visitor.
 */

export type WordmarkCue =
  | { kind: "park"; blurPx: number; threshold: boolean }
  | {
      kind: "play";
      blurPx: number;
      threshold: boolean;
      duration: number;
      startedAt: number;
    }
  | { kind: "settle" };

type WordmarkListener = (cue: WordmarkCue) => void;

const wordmarkListeners = new Set<WordmarkListener>();
let wordmarkCue: WordmarkCue = { kind: "settle" };

function emitWordmark(cue: WordmarkCue): void {
  wordmarkCue = cue;
  wordmarkListeners.forEach((listener) => listener(cue));
}

/** True once a WebGL surface has claimed the mark. */
function hasWordmarkSurface(): boolean {
  return wordmarkListeners.size > 0;
}

/**
 * Claim the wordmark for a WebGL surface. The current cue is delivered
 * synchronously, so a late subscriber lands in the right state. Returns the
 * unsubscribe, which hands the mark back to the DOM.
 */
export function subscribeWordmark(listener: WordmarkListener): () => void {
  wordmarkListeners.add(listener);
  document.documentElement.classList.add(WEBGL_CLASS);
  // The DOM half may already be mid-melt or parked at a blur; drop it now that
  // something else is painting the mark.
  session?.releaseDomWordmark();
  listener(wordmarkCue);
  return () => {
    wordmarkListeners.delete(listener);
    if (hasWordmarkSurface()) return;
    document.documentElement.classList.remove(WEBGL_CLASS);
  };
}

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

/**
 * `canRunGooey`, restated for a surface that has no `#blur-matrix` to check —
 * a WebGL scene resolves the threshold in its own shader, so the one branch
 * that does not carry over is the missing-filter fallback.
 *
 * `blurPx: 0` is "no melt at all": the sub-`GOOEY_MIN_MQ` case the DOM path
 * skips, for the same reason it skips it there.
 */
function meltPlan(gooeyEl: HTMLElement | null): {
  blurPx: number;
  threshold: boolean;
} {
  const radius = gooeyEl ? parseFloat(startBlur(gooeyEl)) || 0 : 0;
  if (usesSoftGooey()) return { blurPx: radius, threshold: false };
  if (window.matchMedia(GOOEY_MIN_MQ).matches) {
    return { blurPx: radius, threshold: true };
  }
  return { blurPx: 0, threshold: false };
}

function createSession(): HomeIntroSession {
  const gooeyEl = document.querySelector<HTMLElement>(GOOEY);
  const lines = Array.from(document.querySelectorAll<HTMLElement>(NAV_LINES));
  const gooey = canRunGooey(gooeyEl) ? gooeyEl : null;

  let tl: gsap.core.Timeline | null = null;
  let waiting = false;
  let skipNav = readFlag(NAV_INTRO_KEY) === "1";

  /**
   * Strip the DOM half back to a plain, unfiltered mark. Called when a WebGL
   * surface takes the wordmark over mid-flight — the nav timeline is left
   * running, only the tween on the mark goes.
   */
  const releaseDomWordmark = () => {
    if (!gooeyEl) return;
    gsap.killTweensOf(gooeyEl);
    clearGooeyBlur(gooeyEl);
    gooeyEl.classList.remove(GOOEY_ARMED);
    gooeyEl.style.filter = "";
    // The visibility gate in `Menu.css` keys off this class, and
    // `tests/helpers.ts` reads it. It stays on whoever is painting.
    gooeyEl.classList.add(GOOEY_PARKED);
  };

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
    releaseDomWordmark();
    emitWordmark({ kind: "settle" });
    settleNav();
  };

  const parkGooey = () => {
    if (!gooeyEl) return;
    gooeyEl.classList.remove(GOOEY_ARMED, GOOEY_PARKED);
    gsap.killTweensOf(gooeyEl);
    clearGooeyBlur(gooeyEl);
    gooeyEl.style.filter = "";

    emitWordmark({ kind: "park", ...meltPlan(gooeyEl) });

    // A WebGL surface owns the mark: the lockup underneath is layout and a11y
    // only, so park it visible and unfiltered rather than at a blur nothing
    // will tween back down.
    if (gooey && !hasWordmarkSurface()) {
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

    const webgl = hasWordmarkSurface();
    // Emitted whichever half is painting, and before the DOM tween is built: a
    // surface that subscribes mid-melt reads `startedAt` off this cue and seeks
    // to the same frame instead of restarting the entrance.
    emitWordmark({
      kind: "play",
      ...meltPlan(gooeyEl),
      duration: GOOEY_S,
      startedAt: performance.now(),
    });

    if (gooey && !webgl) {
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
      releaseDomWordmark();
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
        // Let the mark start resolving before the links arrive. `gooey` alone
        // is the DOM test; on the WebGL path the melt is real whenever
        // `meltPlan` hands back a radius, including under soft mode.
        gooey || meltPlan(gooeyEl).blurPx > 0 ? 0.15 : 0,
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
    return { replay: settle, dispose, releaseDomWordmark };
  }

  park(!skipNav);
  if (isPageRevealed()) play(!skipNav);
  else armWait();

  return { replay, dispose, releaseDomWordmark };
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
