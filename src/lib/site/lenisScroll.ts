import { gsap } from "gsap";
import type Lenis from "lenis";

/**
 * The site's scroll feel, in one place. Was duplicated verbatim in
 * `PortfolioHome` and `WorkProject`; the work overlay is the third consumer and
 * has to match, so it lives here instead of being copied again.
 *
 * `autoRaf: false` is load-bearing — GSAP's ticker drives the frame, see below.
 *
 * Touch is deliberately native. This used to also carry `smoothTouch: false`
 * and `touchMultiplier: 2`, neither of which Lenis has read since 1.0 —
 * `smoothTouch` became `syncTouch`, and the multiplier only applies when that
 * is on. Lenis ignores unknown keys, so the pair described a setting the site
 * never had. Dropped rather than translated: `syncTouch` is off by default,
 * which is the behaviour every phone and tablet has actually been getting.
 */
export const SCROLL_SETTINGS = {
  lerp: 0.1,
  autoRaf: false,
};

/**
 * Drive a Lenis instance off the GSAP ticker so scroll and tweens share one
 * clock. Returns its teardown.
 */
export function driveLenisWithGsap(lenis: Lenis) {
  const raf = (time: number) => lenis.raf(time * 1000);

  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(raf);
  };
}
