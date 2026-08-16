import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export function syncNavForSection(id: string) {
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

function afterSnap(id: string) {
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
  options: Record<string, unknown> = {},
) {
  if (!id || !lenis) return;

  const opts = {
    immediate: true,
    force: true,
    ...options,
    onComplete: () => {
      (options.onComplete as (() => void) | undefined)?.();
      afterSnap(id);
    },
  } as Parameters<Lenis["scrollTo"]>[1];

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
