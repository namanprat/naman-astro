import { lazy, Suspense, useEffect, useState } from "react";

/**
 * Mount gate for the Team cylinder.
 *
 * Do not put `client:visible` on this island. It SSRs nothing, Astro's visible
 * observer watches the island's children, and with no child box it never
 * hydrates — which is why the cylinder vanished. `client:only` hydrates the
 * gate; this observer on `#team` is what actually defers the WebGL mount.
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
