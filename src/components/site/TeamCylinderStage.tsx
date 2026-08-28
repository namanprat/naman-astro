import { lazy, Suspense, useEffect, useState } from "react";

/**
 * Mount gate for the Team cylinder.
 *
 * `client:visible` alone does not defer this. Astro's placeholder
 * `<astro-island>` is `display: contents` and the carousel server-renders
 * nothing, so the island has no box for Astro's own IntersectionObserver to
 * miss — it hydrates at once however far down the page it sits. The gate has to
 * be a real element, which is what `#team` is.
 *
 * Lazy, so `three` and `@react-three/fiber` are not fetched until the section
 * is approached, and mount-gated, so no WebGL context or rAF loop exists before
 * then. Latched once open: tearing the context down on every scroll-past costs
 * far more than leaving it parked at `frameloop: "never"`, which the carousel
 * already handles.
 */
const TeamCylinderCarousel = lazy(() => import("./TeamCylinderCarousel"));

export default function TeamCylinderStage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = document.getElementById("team");
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setMounted(true);
        io.disconnect();
      },
      { rootMargin: "20% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <TeamCylinderCarousel />
    </Suspense>
  );
}
