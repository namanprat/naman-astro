/**
 * Home preloader driver. Runs against the static markup in Preloader.astro —
 * no React, so the overlay paints before any island hydrates.
 */
import gsap from "gsap";
import { getSiteLenis, subscribeSiteLenis } from "./lenisBridge";
import {
  isPreloading,
  PRELOAD_ENTERED_EVENT,
  PRELOADING_CLASS,
} from "./pageReveal";
import { prefersReducedMotion } from "./prefersReducedMotion";
import { startPreload } from "./preloadAssets";
import { segmentCount, subscribe } from "./preloadProgress";
import { initRollingText } from "./rollingText";
import "@/components/site/RollingText.css";
import "./eases";

/**
 * Seconds the counter spends per percentage point. Linear, so at 60fps every
 * integer gets a frame — the number reads as counting rather than jumping even
 * when a 3MB chunk lands in one go.
 */
const SECONDS_PER_PERCENT = 0.016;

const EXIT_S = 0.9;

/**
 * Tweens a displayed value toward the reported progress. One GSAP tween doing
 * what a hand-rolled ticker loop used to; duration scales with the distance
 * left so the pace stays constant however the bytes arrive.
 */
function counterTween(onTick: (value: number) => void) {
  const state = { value: 0 };
  let tween: gsap.core.Tween | null = null;

  return {
    set(next: number) {
      if (next <= state.value) return;
      if (prefersReducedMotion()) {
        state.value = next;
        onTick(next);
        return;
      }
      tween?.kill();
      tween = gsap.to(state, {
        value: next,
        duration: (next - state.value) * SECONDS_PER_PERCENT,
        ease: "none",
        onUpdate: () => onTick(Math.round(state.value)),
      });
    },
    stop() {
      tween?.kill();
    },
  };
}

export function bootPreloader(): void {
  const root = document.querySelector<HTMLElement>(".preloader");
  if (!root) return;

  // Already seen this session — the head script left `is-preloading` off, so
  // drop the markup and let the page behave as any other navigation.
  if (!isPreloading()) {
    root.remove();
    return;
  }
  const card = root.querySelector<HTMLElement>(".preloader__card");

  const percent = root.querySelector<HTMLElement>("[data-preload-percent]");
  const assets = root.querySelector<HTMLElement>("[data-preload-assets]");
  const fill = root.querySelector<HTMLElement>("[data-preload-fill]");
  const cta = root.querySelector<HTMLButtonElement>("[data-preload-cta]");
  const ctaLabel = root.querySelector<HTMLElement>("[data-preload-cta-label]");

  let entered = false;
  let disposeRoll: (() => void) | null = null;

  const unlock = () => {
    if (!cta || cta.dataset.ready === "1") return;
    cta.dataset.ready = "1";
    cta.disabled = false;
    // Fonts are in by now (they're one of the segments), so SplitText measures
    // the real glyphs rather than the fallback.
    if (ctaLabel) disposeRoll = initRollingText(ctaLabel);
    if (prefersReducedMotion()) {
      gsap.set(cta, { opacity: 1 });
    } else {
      gsap.to(cta, {
        opacity: 1,
        duration: 0.45,
        ease: "power2.out",
      });
    }
  };

  /** Pitch of one dot column, read from the CSS so there's one source of truth. */
  const dotPitch = () => {
    const raw = fill
      ? Number.parseFloat(getComputedStyle(fill).backgroundSize)
      : NaN;
    return Number.isFinite(raw) && raw > 0 ? raw : 9;
  };

  const paint = (value: number) => {
    if (percent) percent.textContent = `${value}%`;
    if (fill?.parentElement) {
      // Snap to whole columns — a half-clipped dot reads as a rendering bug.
      // 100% goes full-width instead: the bar rarely divides evenly by the
      // pitch, and a leftover dim dot at the end never reads as "done".
      const pitch = dotPitch();
      const columns = Math.floor(fill.parentElement.clientWidth / pitch);
      fill.style.width =
        value >= 100
          ? "100%"
          : `${Math.floor((value / 100) * columns) * pitch}px`;
    }
    if (assets) {
      // Derived from the displayed number, not the true segment state, so the
      // card can never read "89% ... 4/4" while the counter is still catching up.
      const total = segmentCount();
      assets.textContent = `${Math.floor((value / 100) * total)}/${total}`;
    }
    if (value >= 100) unlock();
  };

  const counter = counterTween(paint);

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter") enter();
  };

  function enter() {
    if (entered || !cta || cta.dataset.ready !== "1") return;
    entered = true;
    counter.stop();
    disposeRoll?.();
    document.removeEventListener("keydown", onKeydown);

    const finish = () => {
      root!.remove();
      document.documentElement.classList.remove(PRELOADING_CLASS);
      unsubscribeLenis();
      getSiteLenis()?.start();
      window.dispatchEvent(new CustomEvent(PRELOAD_ENTERED_EVENT));
    };

    if (prefersReducedMotion()) return finish();

    // Slides up inside .preloader__clip, so the mask edge eats it rather than
    // letting it fly over the page it's about to reveal.
    gsap.to(card, {
      yPercent: -100,
      duration: EXIT_S,
      ease: "introHop",
      onComplete: finish,
    });
  }

  cta?.addEventListener("click", enter);
  document.addEventListener("keydown", onKeydown);

  // The CSS overflow lock can't stop Lenis' own transform loop, and Lenis
  // mounts with the home island — after this module runs. Stop it on arrival
  // as well as now, so scroll is dead for the whole preload either way.
  getSiteLenis()?.stop();
  const unsubscribeLenis = subscribeSiteLenis((lenis) => {
    if (!entered) lenis?.stop();
  });

  // Registers the segments, so `segmentCount()` reports a real total from here on.
  const loading = startPreload();
  const unsubscribe = subscribe((value) => counter.set(value));
  paint(0);

  void loading.then(() => {
    // The failsafe path completes segments without the subscriber having caught
    // up; make sure the counter is always aimed at 100 once loading is over.
    counter.set(100);
    unsubscribe();
  });
}
