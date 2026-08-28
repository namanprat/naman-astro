/**
 * The scroll shell every long page mounts: Lenis at the root, driven off the
 * GSAP ticker.
 */
import { useEffect, type ReactNode } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setSiteLenis } from "./lenisBridge";
import { SCROLL_SETTINGS, driveLenisWithGsap } from "./lenisScroll";

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

export function SiteScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={SCROLL_SETTINGS}>
      <LenisGsapSync />
      {children}
    </ReactLenis>
  );
}
