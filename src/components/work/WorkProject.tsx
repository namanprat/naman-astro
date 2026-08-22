import { useEffect } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { WorkItem } from "@/content/work";
import { setSiteLenis } from "@/lib/site/lenisBridge";
import {
  SCROLL_SETTINGS,
  driveLenisWithGsap,
} from "@/lib/site/lenisScroll";
import Footer from "../site/Footer";
import ProjectDetail from "./ProjectDetail";
import "./Work.css";

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
    const footerPrev = footerEl?.previousElementSibling;

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

type Props = {
  item: WorkItem;
};

export default function WorkProject({ item }: Props) {
  useEffect(() => {
    document.documentElement.classList.add("page-work-project");
    return () => {
      document.documentElement.classList.remove("page-work-project");
    };
  }, []);

  return (
    <ReactLenis root options={SCROLL_SETTINGS}>
      <LenisGsapSync />
      <NavHideOnFooter />
      <article className="work-project">
        <ProjectDetail item={item} variant="page" />
      </article>
      <Footer />
    </ReactLenis>
  );
}
