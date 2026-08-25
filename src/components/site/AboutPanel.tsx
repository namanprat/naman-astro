import "./AboutPanel.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import { shouldMountAboutBust } from "@/lib/site/aboutBust";
import { ABOUT_OPEN_CLASS } from "@/lib/site/aboutPanel";
import { getSiteLenis } from "@/lib/site/lenisBridge";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import {
  addGooeyReveal,
  parkGooey,
  prepareGooey,
} from "@/lib/site/gooeyReveal";
import "@/lib/site/eases";

import AboutContent from "./about/AboutContent";

const BUST_MOUNT_IDLE_MS = 350;
const BUST_FADE_IN_S = 0.6;
const BUST_FADE_FALLBACK_MS = 5000;

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

type AboutPanelProps = {
  open: boolean;
  mode: AboutPanelMode;
  onClose: () => void;
};

function hideChrome(
  panel: HTMLElement,
  surface: HTMLElement,
  backdrop: HTMLElement,
) {
  panel.classList.remove("is-open");
  backdrop.classList.remove("is-open");
  /* inMenu lives on the already-visible overlay — don't park the surface
     off-screen or the next open flashes a card slide. */
  if (!panel.classList.contains("is-in-menu")) {
    gsap.set(surface, { top: "-100vh" });
  } else {
    gsap.set(surface, { clearProps: "transform,top" });
  }
  gsap.set(backdrop, { autoAlpha: 0 });
}

function scheduleAboutBustMount(onMount: () => void): () => void {
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    onMount();
  };
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: BUST_MOUNT_IDLE_MS });
    return () => {
      cancelled = true;
      cancelIdleCallback(id);
    };
  }
  const id = window.setTimeout(run, 0);
  return () => {
    cancelled = true;
    window.clearTimeout(id);
  };
}

export default function AboutPanel({ open, mode, onClose }: AboutPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const prevOpenRef = useRef(false);
  const [mountCanvas, setMountCanvas] = useState(false);
  const [bustReady, setBustReady] = useState(false);
  const onBustReady = useCallback(() => setBustReady(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    if (!prevOpenRef.current) {
      const lead = panel.querySelector<HTMLElement>(".about_panel_lead");
      const leadGooey = lead ? prepareGooey(lead) : null;
      if (leadGooey) parkGooey(leadGooey);
    }

    if (mode !== "inMenu") return;
    panel.classList.add("is-open");
    /* Media only. The copy blocks no longer slide as wholes — Menu splits them
       into lines and parks those, so translating the block too would carry the
       already-parked lines a second screen down. The canvas dissolves rather
       than slides, so this parks alpha, not y. */
    gsap.set(
      panel.querySelectorAll(".about_panel_media .about_panel_reveal_inner"),
      { autoAlpha: 0 },
    );
  }, [open, mode]);

  useEffect(() => {
    const panel = panelRef.current;
    const surface = surfaceRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !surface || !backdrop) return;

    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (open) {
      panel.classList.add("is-open");

      const lead = panel.querySelector<HTMLElement>(".about_panel_lead");
      const leadGooey = lead ? prepareGooey(lead) : null;
      if (leadGooey) parkGooey(leadGooey);

      if (mode === "inMenu") {
        /* Orange overlay is the scrim — keep the page backdrop out of the way.
           Copy reveal is owned by Menu (unreveal links → reveal About). */
        backdrop.classList.remove("is-open");
        gsap.set(backdrop, { autoAlpha: 0 });
        gsap.set(surface, { clearProps: "transform,top" });
        if (!wasOpen) {
          tlRef.current?.kill();
          tlRef.current = null;
        }
        return;
      }

      backdrop.classList.add("is-open");

      /* Entrance only on closed → open. Mode changes while open (resize) must
         not teleport the card off-screen and slide it in again. */
      if (!wasOpen) {
        tlRef.current?.kill();
        const tl = gsap.timeline({
          onReverseComplete: () => {
            hideChrome(panel, surface, backdrop);
          },
        });
        tl.fromTo(
          backdrop,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.45, ease: "power2.out" },
          0,
        );
        /* yPercent on the surface (frosted card), not the padded shell.
           Overflow lives on the inner scroller so the slide isn't clipped
           and frost can sample the page. Force y:0 so any previously parsed
           pixel translate can't keep the card parked above. */
        tl.fromTo(
          surface,
          { top: "-100vh" },
          { top: "0", duration: 0.6, ease: "introHop", force3D: false },
          0,
        );
        /* Its own timeline, deliberately: `tl` gets reversed on close, and a
           reversed gooey reveal re-applies the threshold filter to the whole
           heading — which read as the entire panel going soft on the way out.
           The lead re-parks on the next open, so the entrance is unchanged. */
        if (leadGooey) addGooeyReveal(gsap.timeline(), leadGooey, 0.15);
        tlRef.current = tl;
      }
      return;
    }

    /* Reversing is what keeps the card locked to the nav: Menu closes the nav by
       reversing its own 0.6s introHop tween, so the card has to come back up the
       same way or the two drift apart. A hand-written exit tween cannot match a
       reversed ease. The gooey lead is deliberately not in this timeline (see
       the entrance), so reversing moves y and the scrim — nothing blurs. */
    if (tlRef.current) {
      tlRef.current.reverse();
    } else {
      hideChrome(panel, surface, backdrop);
    }
  }, [open, mode]);

  /* Follows the prop, so the cleanup runs even when the exit animation does
     not complete. See ABOUT_OPEN_CLASS. Lenis hijacks wheel independently of
     `overflow: hidden`, so it has to be stopped here or the page behind the
     overlay keeps moving. */
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add(ABOUT_OPEN_CLASS);
    getSiteLenis()?.stop();
    return () => {
      root.classList.remove(ABOUT_OPEN_CLASS);
      getSiteLenis()?.start();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMountCanvas(false);
      setBustReady(false);
      return;
    }

    if (window.matchMedia("(width < 48rem)").matches) return;
    if (!shouldMountAboutBust()) return;

    const cancel = scheduleAboutBustMount(() => {
      if (!openRef.current) return;
      setMountCanvas(true);
    });

    return cancel;
  }, [open]);

  useEffect(() => {
    if (!bustReady || !mediaRef.current || prefersReducedMotion()) return;
    const canvas = mediaRef.current.querySelector("canvas");
    if (!canvas) return;
    gsap.fromTo(
      canvas,
      { opacity: 0.001 },
      { opacity: 1, duration: BUST_FADE_IN_S, ease: "power2.out" },
    );
  }, [bustReady]);

  useEffect(() => {
    if (!open || !mountCanvas || prefersReducedMotion()) return;
    const id = window.setTimeout(() => {
      const canvas = mediaRef.current?.querySelector("canvas");
      if (!canvas) return;
      gsap.to(canvas, {
        opacity: 1,
        duration: BUST_FADE_IN_S,
        ease: "power2.out",
      });
    }, BUST_FADE_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [open, mountCanvas]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button
        ref={backdropRef}
        type="button"
        className="about_panel_backdrop"
        aria-label="Close about"
        tabIndex={open && mode !== "inMenu" ? 0 : -1}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        id="site-about-panel"
        tabIndex={-1}
        className={aboutPanelClass(mode)}
        aria-hidden={!open}
        aria-label="About"
      >
        {/* Fill + frost live on `__surface` so the panel can stay transparent
            and hold the floating gutter as padding. Scroll is the inner
            `__scroll` — overflow on the frost node makes a backdrop root.

            `data-lenis-prevent`: the inner scroller is the panel's overflow
            container, and Lenis preventDefaults wheel/touch on the whole
            document — so without opting out, its own overflow never moves and
            the content below the fold is unreachable. Page scroll is already
            stopped while the panel is open, so nothing here fights the page. */}
        <div className="about_panel_surface" ref={surfaceRef}>
          <div className="about_panel_scroll" data-lenis-prevent>
            <div className="about_panel_inner container gap-0">
              <AboutContent
                mediaRef={mediaRef}
                mountCanvas={mountCanvas}
                onCanvasReady={onBustReady}
              />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
