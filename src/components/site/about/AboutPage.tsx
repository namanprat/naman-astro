import "../AboutPanel.css";
import { useEffect, useRef, useState } from "react";
import { shouldMountAboutBust } from "@/lib/site/aboutBust";
import AboutContent from "./AboutContent";

/**
 * About as a real route, used below 48rem where the floating card was too
 * cramped to carry the bust.
 *
 * Reuses `.about_panel` wholesale: phone stacking for the overlay still
 * lives on `.about_panel:not(.is-in-menu)`, and `is-page` inherits that then
 * remaps Services / Clients onto the 4/6-col site grid (see the `is-page`
 * block at the end of AboutPanel.css).
 *
 * Deliberately not `AboutPanel` with another mode: that component's whole body
 * is open/close choreography — backdrop, escape key, ABOUT_OPEN_CLASS, the
 * slide-in timeline — none of which a page has.
 *
 * No fade-in on the canvas either, unlike the panel. The panel fades because it
 * animates open; a page is simply there. Skipping it also drops a GSAP tween
 * that cannot advance while the tab is backgrounded — which would leave the
 * bust parked at opacity 0 on a route opened in a background tab.
 */
export default function AboutPage() {
  const mediaRef = useRef<HTMLDivElement>(null);
  const [mountCanvas, setMountCanvas] = useState(false);

  /* No width bail, unlike the panel: this route only renders on phones, and
     mounting the bust here is the point. The device tier still gates it —
     `shouldMountAboutBust()` refuses tier 0/1 (no WebGL, weak GPU, reduced
     motion) and `getAboutCanvasMaxDpr()` already pins mobile to 1x.

     In an effect, not render: the probe touches WebGL and `navigator`, so it
     must not run during SSR or the first hydration pass. */
  useEffect(() => {
    if (shouldMountAboutBust()) setMountCanvas(true);
  }, []);

  return (
    <div className="about_panel is-page is-open">
      <div className="about_panel_surface">
        {/* No `data-lenis-prevent` here — the document scrolls, not this box. */}
        <div className="about_panel_scroll">
          <div className="about_panel_inner container gap-0">
            <AboutContent mediaRef={mediaRef} mountCanvas={mountCanvas} />
          </div>
        </div>
      </div>
    </div>
  );
}
