/**
 * The scroll shell every long page mounts: Lenis at the root, driven off the
 * GSAP ticker, with the nav fading out over the footer.
 *
 * `PortfolioHome` and `WorkProject` each carried a verbatim copy of both
 * helpers. Home Footer is an Astro island, so the preceding block is found via
 * `previousFlowSibling` (walks past the island host to `.studio`).
 */
import { useEffect, type ReactNode } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { setSiteLenis } from "./lenisBridge";
import { SCROLL_SETTINGS, driveLenisWithGsap } from "./lenisScroll";
import { previousFlowSibling } from "./previousFlowSibling";

gsap.registerPlugin(ScrollTrigger);

/** Publish the root Lenis instance and hand its frame to the GSAP ticker. */
function LenisGsapSync(): null {
  const lenis = useLenis(ScrollTrigger.update);

  useEffect(() => {
    if (!lenis) return;
    setSiteLenis(lenis);
    const stopDriving = driveLenisWithGsap(lenis);
    return () => {
      stopDriving();
      setSiteLenis(null);
    };
  }, [lenis]);

  return null;
}

/** Fade the nav out while the footer owns the viewport. */
function NavHideOnFooter(): null {
  useGSAP(() => {
    const navBar = document.querySelector(".nav_grid");
    const footerEl = document.querySelector<HTMLElement>(".footer_wrap");
    const footerPrev = previousFlowSibling(footerEl);

    const setNavHidden = (hidden: boolean) => {
      if (!navBar) return;
      gsap.to(navBar, {
        autoAlpha: hidden ? 0 : 1,
        duration: 0.35,
        overwrite: "auto",
      });
      if (!hidden) ScrollTrigger.update();
    };

    const navHideTrigger = footerPrev
      ? ScrollTrigger.create({
          trigger: footerPrev,
          start: "bottom bottom",
          end: () => "+=" + (footerEl?.offsetHeight || 0),
          onEnter: () => setNavHidden(true),
          onLeaveBack: () => setNavHidden(false),
          invalidateOnRefresh: true,
        })
      : null;

    // Metrics shift once the webfonts land, so the trigger has to re-measure.
    document.fonts?.ready?.then(() => ScrollTrigger.refresh());

    return () => {
      navHideTrigger?.kill();
      if (navBar) gsap.set(navBar, { clearProps: "opacity,visibility" });
    };
  }, []);

  return null;
}

export function SiteScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={SCROLL_SETTINGS}>
      <LenisGsapSync />
      <NavHideOnFooter />
      {children}
    </ReactLenis>
  );
}
