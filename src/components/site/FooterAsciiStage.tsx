/**
 * Gate for the footer's ASCII wordmark: desktop only, and only once the footer
 * is near enough to be worth a WebGL context.
 *
 * ponytail: a light island in front of a heavy one. `FooterAsciiLogo` pulls in
 * `FooterAsciiField`, which owns a WebGL context and a rAF loop; the footer is
 * the last thing on every long page, so booting that at load meant one more
 * live context competing with the backdrop for the whole time nobody could see
 * it. This wrapper is small enough to hydrate eagerly and defers the rest.
 * `Footer.tsx` did both jobs in one island; the footer is Astro now, so the
 * gating had to become its own component rather than disappear.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { MOBILE_LAYOUT_MQ } from "@/lib/site/util/isMobileLayout";

const FooterAsciiLogo = lazy(() => import("./FooterAsciiLogo"));

export default function FooterAsciiStage({
  sourceSelector,
}: {
  sourceSelector: string;
}) {
  /* Phones show the plain masked wordmark instead (Footer's styles). Gating the
     mount rather than hiding the canvas matters: the field owns a WebGL context
     and a rAF loop. */
  const [wide, setWide] = useState(false);
  /* Latched — once built, the field stays, so scrolling past does not churn
     contexts. */
  const [near, setNear] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ);
    const sync = () => setWide(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "50% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-footer-ascii-stage>
      {wide && near ? (
        <Suspense fallback={null}>
          <FooterAsciiLogo sourceSelector={sourceSelector} />
        </Suspense>
      ) : null}
    </div>
  );
}
