/** Module API so Menu, Footer, and any link can open About without page routing. */

import { MOBILE_LAYOUT_MQ } from "./isMobileLayout";
import { go } from "./navigate";

type AboutSetter = (open: boolean | ((prev: boolean) => boolean)) => void;

export const ABOUT_PATH = "/about";

/**
 * Below the nav breakpoint About is a real route, not the floating card — the
 * card had no room for the bust. Above it the overlay is unchanged.
 *
 * Same 48rem cut as `Menu.css`'s phone block and `DESKTOP_NAV_MQ`; `/about`
 * itself bounces desktop widths back to `/#about` pre-paint.
 */
export function aboutIsRoute(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_LAYOUT_MQ).matches;
}

/**
 * Open About however this viewport does it. Every entry point — nav, footer,
 * a stray `#about` anchor — goes through here so the two behaviours can never
 * disagree about which one is in play.
 */
export function openAbout(): void {
  if (!aboutIsRoute()) {
    toggleAboutPanel();
    return;
  }
  if (window.location.pathname === ABOUT_PATH) return;
  void go(ABOUT_PATH);
}

let setter: AboutSetter | null = null;

/**
 * On `<html>` for exactly as long as About is up, driven by the panel's `open`
 * prop.
 *
 * Distinct from `.about_panel.is-open`, which carries `visibility` and
 * `pointer-events` and so has to outlive the exit animation — it is removed
 * from `onReverseComplete`. Anything asking "is About up?" needs the state, not
 * the animation's lifetime: `WorkGallery` mutes the gallery's wheel and touch
 * while About is open, and an exit that never completes would have muted it for
 * good, with nothing on screen to explain why.
 */
export const ABOUT_OPEN_CLASS = "about-open";

export function registerAboutPanel(fn: AboutSetter | null): void {
  setter = fn;
}

export function openAboutPanel(): void {
  setter?.(true);
}

export function toggleAboutPanel(open?: boolean): void {
  if (!setter) return;
  if (typeof open === "boolean") {
    setter(open);
  } else {
    setter((prev) => !prev);
  }
}

export function closeAboutPanel(): void {
  setter?.(false);
}

function isAboutHref(href: string | null | undefined): boolean {
  if (!href) return false;
  if (href === "#about" || href === "/#about") return true;
  try {
    const url = new URL(href, window.location.origin);
    return url.hash === "#about";
  } catch {
    return false;
  }
}

function clearAboutHash() {
  if (window.location.hash !== "#about") return;
  const next = `${window.location.pathname}${window.location.search}`;
  history.replaceState(history.state, "", next || "/");
}

/**
 * Global About handling for deep links / unmanaged anchors.
 * Nav + Footer keep their own handlers; this catches `#about` hashes and
 * stray links so they never hard-navigate away from the current page.
 */
export function installAboutInterceptors(): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (!isAboutHref(anchor.getAttribute("href"))) return;

    // Nav / overlay / footer already call toggleAboutPanel themselves.
    if (anchor.closest(".nav_wrap, .menu_wrap, .footer_wrap")) return;

    event.preventDefault();
    event.stopPropagation();
    openAbout();
    clearAboutHash();
  };

  const syncHash = () => {
    if (window.location.hash !== "#about") return;
    /* Deep link on a phone: hand it to the route rather than opening the card
       over whatever page it landed on. */
    if (aboutIsRoute()) {
      clearAboutHash();
      openAbout();
      return;
    }
    openAboutPanel();
    clearAboutHash();
  };

  document.addEventListener("click", onClick, true);
  window.addEventListener("hashchange", syncHash);
  syncHash();

  return () => {
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("hashchange", syncHash);
  };
}
