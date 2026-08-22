import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
// Aliased: the name collides with the DOM's own `ScrollToOptions`.
import type { ScrollToOptions as LenisScrollToOptions } from "lenis";

gsap.registerPlugin(ScrollTrigger);

function syncNavForSection(id: string): void {
  const navBar = document.querySelector(".nav_grid");
  const wordmark = document.querySelector(".nav-logo-wordmark");
  const footerActive = id === "contact";

  if (wordmark) {
    gsap.set(wordmark, {
      autoAlpha: footerActive ? 0 : 1,
    });
  }

  if (navBar) {
    gsap.set(navBar, { autoAlpha: footerActive ? 0 : 1 });
  }
}

function afterSnap(id: string): void {
  ScrollTrigger.update();
  syncNavForSection(id);
  requestAnimationFrame(() => {
    ScrollTrigger.update();
    syncNavForSection(id);
  });
}

export function scrollToSection(
  lenis: Lenis | null | undefined,
  id: string,
  options: LenisScrollToOptions = {},
): void {
  if (!id || !lenis) return;

  const opts: LenisScrollToOptions = {
    immediate: true,
    force: true,
    ...options,
    onComplete: (instance) => {
      options.onComplete?.(instance);
      afterSnap(id);
    },
  };

  if (id === "contact") {
    lenis.scrollTo("bottom", opts);
    afterSnap(id);
    return;
  }

  if (id === "hero") {
    lenis.scrollTo(0, opts);
    afterSnap(id);
    return;
  }

  const el = document.getElementById(id);
  if (!el) return;
  lenis.scrollTo(el, opts);
  afterSnap(id);
}

export function hashId(path: string): string {
  if (!path) return "";
  if (path.startsWith("/#")) return path.slice(2);
  if (path.startsWith("#")) return path.slice(1);
  return "";
}
