import { useEffect, useRef } from "react";
import "./FluidCanvas.css";
import { FluidSimulation } from "../../lib/site/fluid/FluidSimulation";

const HERO_DIM = "is-hero-fluid-dim";

export default function FluidCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const simulation = new FluidSimulation(canvas);
    return () => simulation.dispose();
  }, []);

  useEffect(() => {
    const hero = document.querySelector(".hero");
    const root = document.documentElement;
    if (!hero) {
      root.classList.remove(HERO_DIM);
      return;
    }

    const sync = (visible: boolean) => {
      root.classList.toggle(HERO_DIM, !visible);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        sync(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(hero);
    sync(hero.getBoundingClientRect().bottom > 0);

    return () => {
      observer.disconnect();
      root.classList.remove(HERO_DIM);
    };
  }, []);

  return (
    <div ref={wrapRef} className="fluid-wrap" data-fluid aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
