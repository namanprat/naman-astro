/**
 * Glue the desktop nav to the About card's live bottom edge.
 *
 * The card slides by tweening `top`; the bar has to follow that rect every
 * tick or it sits at the settled dock while the card is still moving — the
 * close then looks like a snap to the bottom and a second hop home.
 */
import gsap from "gsap";
import { MOBILE_LAYOUT_MQ } from "./isMobileLayout";

let restTop: number | null = null;

function navY(nav: HTMLElement): number {
  return parseFloat(String(gsap.getProperty(nav, "y"))) || 0;
}

export function followAboutNav(surface: HTMLElement): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(MOBILE_LAYOUT_MQ).matches) return;
  if (document.documentElement.classList.contains("menu-open")) return;
  const nav = document.querySelector<HTMLElement>(".nav_wrap");
  if (!nav) return;
  restTop ??= nav.getBoundingClientRect().top - navY(nav);
  gsap.set(nav, {
    y: Math.max(0, surface.getBoundingClientRect().bottom - restTop),
  });
}

export function releaseAboutNav(): void {
  restTop = null;
  const nav = document.querySelector<HTMLElement>(".nav_wrap");
  if (nav) gsap.set(nav, { clearProps: "transform" });
}
