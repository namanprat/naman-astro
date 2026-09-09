import gsap from "gsap";
import { ABOUT_OPEN_CLASS } from "./aboutPanel";
import { followAboutNav, releaseAboutNav } from "./aboutNavDock";
import { getSiteLenis } from "../scroll/lenisBridge";
import { prefersReducedMotion } from "../util/prefersReducedMotion";
import {
  addGooeyReveal,
  parkGooey,
  prepareGooey,
} from "../reveal/gooeyReveal";
import "../util/eases";

const SLIDE_S = 0.45;

export type AboutPanelMode = "ride" | "padded" | "inMenu";

function aboutPanelClass(mode: AboutPanelMode): string {
  switch (mode) {
    case "ride":
      return "about_panel";
    case "padded":
      return "about_panel is-padded";
    case "inMenu":
      return "about_panel is-in-menu";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

type AboutOverlayControl = {
  isOpen: () => boolean;
  mode: () => AboutPanelMode;
  setOpen: (open: boolean, mode?: AboutPanelMode) => void;
};

let control: AboutOverlayControl | null = null;

export function aboutOverlayIsOpen(): boolean {
  return control?.isOpen() ?? false;
}

export function aboutOverlayMode(): AboutPanelMode {
  return control?.mode() ?? "ride";
}

export function setAboutOverlay(open: boolean, mode?: AboutPanelMode): void {
  control?.setOpen(open, mode);
}

function hideChrome(
  panel: HTMLElement,
  surface: HTMLElement,
  backdrop: HTMLElement,
): void {
  panel.classList.remove("is-open");
  backdrop.classList.remove("is-open");
  if (!panel.classList.contains("is-in-menu")) {
    gsap.set(surface, { top: "-100vh" });
  } else {
    gsap.set(surface, { clearProps: "transform,top" });
  }
  gsap.set(backdrop, { autoAlpha: 0 });
  releaseAboutNav();
}

export function bootAboutPanel(): void {
  const panel = document.querySelector<HTMLElement>("[data-about-panel]");
  const surface = document.querySelector<HTMLElement>("[data-about-surface]");
  const backdrop = document.querySelector<HTMLButtonElement>(
    "[data-about-backdrop]",
  );
  if (!panel || !surface || !backdrop) return;

  let open = false;
  let mode: AboutPanelMode = "ride";
  let tl: gsap.core.Timeline | null = null;

  const applyMode = (next: AboutPanelMode) => {
    mode = next;
    panel.className = aboutPanelClass(next);
    if (open) panel.classList.add("is-open");
  };

  const setOpen = (next: boolean, nextMode: AboutPanelMode = mode) => {
    const wasOpen = open;
    applyMode(nextMode);
    open = next;
    panel.setAttribute("aria-hidden", String(!next));
    backdrop.tabIndex = next && nextMode !== "inMenu" ? 0 : -1;

    if (next) {
      panel.classList.add("is-open");
      document.documentElement.classList.add(ABOUT_OPEN_CLASS);
      getSiteLenis()?.stop();

      const lead = panel.querySelector<HTMLElement>(".about_panel_lead");
      const leadGooey = lead ? prepareGooey(lead) : null;
      if (leadGooey) parkGooey(leadGooey);

      if (nextMode === "inMenu") {
        backdrop.classList.remove("is-open");
        gsap.set(backdrop, { autoAlpha: 0 });
        gsap.set(surface, { clearProps: "transform,top" });
        gsap.set(
          panel.querySelectorAll(
            ".about_panel_media .about_panel_reveal_inner",
          ),
          { autoAlpha: 0 },
        );
        if (!wasOpen) {
          tl?.kill();
          tl = null;
        }
        return;
      }

      backdrop.classList.add("is-open");
      if (!wasOpen) {
        tl?.kill();
        if (prefersReducedMotion()) {
          gsap.set(backdrop, { autoAlpha: 1 });
          gsap.set(surface, { top: "0" });
          followAboutNav(surface);
          if (leadGooey) addGooeyReveal(gsap.timeline(), leadGooey, 0);
          tl = null;
        } else {
          tl = gsap.timeline({
            onReverseComplete: () => {
              hideChrome(panel, surface, backdrop);
            },
          });
          tl.fromTo(
            backdrop,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: SLIDE_S, ease: "power2.out" },
            0,
          );
          tl.fromTo(
            surface,
            { top: "-100vh" },
            {
              top: "0",
              duration: SLIDE_S,
              ease: "hop",
              force3D: false,
              onUpdate: () => followAboutNav(surface),
            },
            0,
          );
          if (leadGooey) addGooeyReveal(gsap.timeline(), leadGooey, 0.1);
        }
      }
      return;
    }

    document.documentElement.classList.remove(ABOUT_OPEN_CLASS);
    getSiteLenis()?.start();
    if (tl) tl.reverse();
    else hideChrome(panel, surface, backdrop);
  };

  control = {
    isOpen: () => open,
    mode: () => mode,
    setOpen,
  };

  backdrop.addEventListener("click", () => setOpen(false));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) setOpen(false);
  });
}
