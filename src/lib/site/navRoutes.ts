/**
 * One route table for every in-page nav control.
 *
 * The navbar and the footer render the same link list (`NAV_STACKS`) and both
 * intercept the click, but each carried its own copy of what a path means.
 * They drifted: the footer's "/" branch assumed it was always already on home,
 * so it replayed the hero intro and scrolled to `#hero` — on a project page
 * that is a `preventDefault()` and nothing else, and the link did not navigate
 * at all. Anything routed through here gets the covered transition and the
 * `/work` return handling for free.
 */
import type Lenis from "lenis";
import { go, type GoOptions } from "./navigate";
import { hashId, scrollToSection } from "./scrollToSection";
import { closeAboutPanel, openAbout } from "./aboutPanel";
import { replayHomeIntro } from "./heroIntro";
import { markWorkReturn } from "./workSession";

type RouteContext = {
  lenis?: Lenis | null;
  options?: GoOptions;
};

/** Handle a nav path. Callers have already called `preventDefault`. */
export function goToRoute(path: string, ctx: RouteContext = {}): void {
  const { lenis, options } = ctx;
  const id = hashId(path);
  const onHome = window.location.pathname === "/";

  if (path === "/archive") {
    closeAboutPanel();
    if (window.location.pathname === "/archive") return;
    void go("/archive", options);
    return;
  }

  if (path === "/work") {
    // Mid Flip (overlay open on /work) — reverse in place.
    if (document.documentElement.classList.contains("work-project-open")) {
      window.dispatchEvent(new CustomEvent("work:close"));
      return;
    }
    // Hard-loaded `/work/[slug]` — no overlay in this document to reverse,
    // so flag it and let /work replay the close on arrival.
    if (/^\/work\/[^/]+/.test(window.location.pathname)) {
      markWorkReturn();
      void go("/work", options);
      return;
    }
    if (window.location.pathname === "/work") return;
    void go("/work", options);
    return;
  }

  if (path === "/" || id === "hero") {
    closeAboutPanel();
    if (!onHome) {
      void go("/", options);
      return;
    }
    replayHomeIntro();
    scrollToSection(lenis, "hero");
    return;
  }

  if (id === "about") {
    /* Overlay on desktop, real route on phones — `openAbout` owns the fork so
       nav, footer and stray `#about` anchors cannot disagree. */
    openAbout();
    return;
  }

  if (id === "team") {
    closeAboutPanel();
    if (!onHome) {
      void go("/#team", options);
      return;
    }
    scrollToSection(lenis, "team");
    return;
  }

  if (id === "contact") {
    closeAboutPanel();
    if (!onHome) {
      void go("/#contact", options);
      return;
    }
    scrollToSection(lenis, "contact");
  }
}
