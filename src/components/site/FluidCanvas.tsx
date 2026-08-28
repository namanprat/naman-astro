import { useEffect, useRef } from "react";
import "./FluidCanvas.css";
import { FluidSimulation } from "@/lib/site/fluid/FluidSimulation";
import { MOBILE_LAYOUT_MQ } from "@/lib/site/isMobileLayout";

const HERO_DIM = "is-hero-fluid-dim";

export default function FluidCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const simulation = new FluidSimulation(canvas);
    return () => simulation.dispose();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ);
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    let cancelled = false;

    const detach = () => {
      io?.disconnect();
      io = null;
      mo?.disconnect();
      mo = null;
      root.classList.remove(HERO_DIM);
    };

    const attach = (studio: Element) => {
      const sync = (visible: boolean) => {
        root.classList.toggle(HERO_DIM, visible);
      };
      io = new IntersectionObserver(
        ([entry]) => {
          sync(entry.isIntersecting);
        },
        { threshold: 0 },
      );
      io.observe(studio);
      sync(studio.getBoundingClientRect().top < window.innerHeight);
    };

    const bindStudio = () => {
      const studio = document.querySelector(".studio");
      if (studio) {
        attach(studio);
        return;
      }
      /* Both islands are `client:only` — this effect can run before
         PortfolioHome has written `.studio`. */
      mo = new MutationObserver(() => {
        const el = document.querySelector(".studio");
        if (!el) return;
        mo?.disconnect();
        mo = null;
        if (!cancelled) attach(el);
      });
      mo.observe(document.body, { childList: true, subtree: true });
    };

    const apply = () => {
      detach();
      if (cancelled) return;
      /* Phone: leave the sim at its base opacity. Scrolling `.studio` over
         the fixed wrap must not dim it. */
      if (mq.matches) return;
      bindStudio();
    };

    apply();
    mq.addEventListener("change", apply);

    return () => {
      cancelled = true;
      mq.removeEventListener("change", apply);
      detach();
    };
  }, []);

  return (
    <div className="fluid_wrap" data-fluid aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
