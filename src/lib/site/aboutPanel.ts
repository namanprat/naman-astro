/** Module API so Menu, Footer, and any link can open About without page routing. */

type AboutSetter = (open: boolean | ((prev: boolean) => boolean)) => void;

let setter: AboutSetter | null = null;

/**
 * On `<html>` for exactly as long as About is up, driven by the panel's `open`
 * prop.
 *
 * Distinct from `.about-panel.is-open`, which carries `visibility` and
 * `pointer-events` and so has to outlive the exit animation — it is removed
 * from `onReverseComplete`. Anything asking "is About up?" needs the state, not
 * the animation's lifetime: `WorkGallery` mutes the gallery's wheel and touch
 * while About is open, and an exit that never completes would have muted it for
 * good, with nothing on screen to explain why.
 */
export const ABOUT_OPEN_CLASS = "about-open";

export function registerAboutPanel(fn: AboutSetter | null) {
  setter = fn;
}

export function openAboutPanel() {
  setter?.(true);
}

export function toggleAboutPanel(open?: boolean) {
  if (!setter) return;
  if (typeof open === "boolean") {
    setter(open);
  } else {
    setter((prev) => !prev);
  }
}

export function closeAboutPanel() {
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
    if (anchor.closest(".nav-container, .menu, .footer")) return;

    event.preventDefault();
    event.stopPropagation();
    toggleAboutPanel();
    clearAboutHash();
  };

  const syncHash = () => {
    if (window.location.hash !== "#about") return;
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
