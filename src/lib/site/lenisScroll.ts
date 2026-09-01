import { gsap } from "gsap";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setSiteLenis } from "./lenisBridge";

gsap.registerPlugin(ScrollTrigger);

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
export function driveLenisWithGsap(lenis: Lenis): () => void {
  const raf = (time: number) => lenis.raf(time * 1000);

  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(raf);
  };
}

/**
 * The document scroller every long page boots, and publishes for the chrome
 * that reads it off `lenisBridge`.
 *
 * Lenis takes the document itself, so this owns no markup and never did — it
 * was a React island (`<ReactLenis root>`) on home, `/work/[slug]` and
 * `/about` purely to have a component to hang the instance off, which is why
 * three routes hydrated React to run one constructor. `WorkGallery` already
 * built its overlay instance this way.
 */
export function bootSiteScroll(): () => void {
  const lenis = new Lenis(SCROLL_SETTINGS);
  /* What `useLenis(ScrollTrigger.update)` did: scroll and tweens share a clock
     through the ticker above, but ScrollTrigger still has to be told the
     scroller moved. */
  lenis.on("scroll", ScrollTrigger.update);
  setSiteLenis(lenis);
  const stopDriving = driveLenisWithGsap(lenis);

  return () => {
    stopDriving();
    setSiteLenis(null);
    lenis.destroy();
  };
}
