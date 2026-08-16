import { useEffect } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { setSiteLenis } from "../../lib/site/lenisBridge";
import {
  SCROLL_SETTINGS,
  driveLenisWithGsap,
} from "../../lib/site/lenisScroll";
import Manifesto from "./Manifesto";
import Team from "./Team";
import Footer from "./Footer";

gsap.registerPlugin(ScrollTrigger);

function LenisGsapSync() {
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

function NavHideOnFooter() {
  useGSAP(() => {
    const navBar = document.querySelector(".nav_grid");
    const footerEl = document.querySelector(".footer");
    const footerPrev =
      footerEl?.previousElementSibling || document.querySelector(".studio");

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
          end: () => "+=" + ((footerEl as HTMLElement)?.offsetHeight || 0),
          onEnter: () => setNavHidden(true),
          onLeaveBack: () => setNavHidden(false),
          invalidateOnRefresh: true,
        })
      : null;

    document.fonts?.ready?.then(() => ScrollTrigger.refresh());

    return () => {
      navHideTrigger?.kill();
      if (navBar) gsap.set(navBar, { clearProps: "opacity,visibility" });
    };
  }, []);

  return null;
}

export default function PortfolioHome() {
  return (
    <ReactLenis root options={SCROLL_SETTINGS}>
      <LenisGsapSync />
      <NavHideOnFooter />
      <section className="hero" id="hero" aria-label="Home" />
      <div className="studio">
        <Manifesto />
        <Team />
      </div>
      <Footer />
    </ReactLenis>
  );
}
