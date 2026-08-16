/**
 * Line-by-line entrance for the arriving page's copy. Runs once per load, after
 * the transition panel has cleared. Text is held hidden by the
 * `is-line-revealing` class (set pre-paint in BaseLayout) until the lines are
 * split and parked, so nothing flashes at full opacity first.
 */
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { prefersReducedMotion } from "./prefersReducedMotion";
import { pollUntil } from "./pollUntil";

gsap.registerPlugin(SplitText);

/** Body copy only — headings are the gooey's, see `gooeyReveal.ts`. */
const TARGETS = ".text-style-main";

/** Text that already belongs to another animation, plus a per-page opt-out. */
const SKIP =
  ".transition-panel, .menu, .nav-container, .footer, .about-panel, .manifesto, .content__group, [data-no-reveal]";

/**
 * Budget for holding text hidden. Text must never stay hidden if fonts, an
 * island, or SplitText fail — past this the page just shows, unanimated.
 * ponytail: a flat deadline, not per-stage timeouts. If a page ever needs
 * longer, raise this one number rather than adding stages.
 */
const FAILSAFE_MS = 2000;

/** How often to re-check for island copy while inside the budget. */
const POLL_MS = 50;

/** Everything in the document that this module is allowed to animate. */
function queryTargets(): HTMLElement[] {
  // Below-fold copy would animate where nobody is looking; leave it be. A zero
  // height means the viewport hasn't reported yet (hidden/collapsed frame) —
  // fall back to revealing everything rather than nothing.
  const fold = window.innerHeight || Infinity;
  return Array.from(document.querySelectorAll<HTMLElement>(TARGETS)).filter(
    (el) => !el.closest(SKIP) && el.getBoundingClientRect().top < fold,
  );
}

export async function revealLines(): Promise<void> {
  const root = document.documentElement;
  const done = () => root.classList.remove("is-line-revealing");

  if (prefersReducedMotion()) return done();

  let expired = false;
  const failsafe = setTimeout(() => {
    expired = true;
    done();
  }, FAILSAFE_MS);

  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, FAILSAFE_MS)),
    ]);
    // `client:only` islands (project pages, archive) mount after this module
    // runs, so the copy often isn't in the DOM yet.
    const targets = await pollUntil(queryTargets, {
      deadline: performance.now() + FAILSAFE_MS,
      intervalMs: POLL_MS,
    });

    // Past the deadline the text is already on screen; splitting it now would
    // yank visible copy back down for a second entrance.
    if (!targets.length || expired) return done();

    const split = new SplitText(targets, { type: "lines", mask: "lines" });
    gsap.set(split.lines, { yPercent: 110 });
    done();
    gsap.to(split.lines, {
      yPercent: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.06,
    });
  } catch {
    done();
  } finally {
    clearTimeout(failsafe);
  }
}
