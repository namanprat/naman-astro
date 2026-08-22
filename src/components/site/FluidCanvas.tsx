import { useEffect, useRef } from "react";
import "./FluidCanvas.css";
import { FluidSimulation } from "@/lib/site/fluid/FluidSimulation";

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
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    let cancelled = false;

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

    const studio = document.querySelector(".studio");
    if (studio) {
      attach(studio);
    } else {
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
    }

    return () => {
      cancelled = true;
      io?.disconnect();
      mo?.disconnect();
      root.classList.remove(HERO_DIM);
    };
  }, []);

  return (
    <div className="fluid_wrap" data-fluid aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
