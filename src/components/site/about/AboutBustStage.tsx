/**
 * Gate for the About bust. R3F has to live in a React root; this is the
 * whole of what stays React here — when to pay for the canvas.
 *
 * `eager` is the `/about` page (mount as soon as the device can take it).
 * The overlay waits for `html.about-open` and a short delay so the card
 * slide does not hitch.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { shouldMountAboutBust } from "@/lib/site/about/aboutBust";
import { ABOUT_OPEN_CLASS } from "@/lib/site/about/aboutPanel";
import { prefersReducedMotion } from "@/lib/site/util/prefersReducedMotion";
import gsap from "gsap";

const AboutAsciiCanvas = lazy(() => import("./AboutAsciiCanvas"));

const BUST_MOUNT_DELAY_MS = 500;
const BUST_FADE_IN_S = 0.6;
const BUST_FADE_FALLBACK_MS = 5000;

export default function AboutBustStage({ eager = false }: { eager?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mountCanvas, setMountCanvas] = useState(false);

  useEffect(() => {
    if (!shouldMountAboutBust()) return;

    if (eager) {
      setMountCanvas(true);
      return;
    }

    const tryMount = () => {
      if (!document.documentElement.classList.contains(ABOUT_OPEN_CLASS)) {
        return;
      }
      if (window.matchMedia("(width < 48rem)").matches) return;
      const id = window.setTimeout(() => setMountCanvas(true), BUST_MOUNT_DELAY_MS);
      return () => window.clearTimeout(id);
    };

    let cancel = tryMount();
    const mo = new MutationObserver(() => {
      cancel?.();
      if (!document.documentElement.classList.contains(ABOUT_OPEN_CLASS)) {
        setMountCanvas(false);
        return;
      }
      cancel = tryMount();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      cancel?.();
      mo.disconnect();
    };
  }, [eager]);

  useEffect(() => {
    /* The `/about` page is already on screen — no fade. The overlay fades
       because it animates open; skipping it here also drops a tween that
       cannot advance while the tab is backgrounded. */
    if (!mountCanvas || eager || prefersReducedMotion()) return;
    const host = hostRef.current;
    if (!host) return;

    const fade = () => {
      const canvas = host.querySelector("canvas");
      if (!canvas) return false;
      gsap.fromTo(
        canvas,
        { opacity: 0.001 },
        { opacity: 1, duration: BUST_FADE_IN_S, ease: "power2.out" },
      );
      return true;
    };

    if (fade()) return;
    const id = window.setTimeout(() => fade(), BUST_FADE_FALLBACK_MS);
    const io = new MutationObserver(() => {
      if (fade()) io.disconnect();
    });
    io.observe(host, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(id);
      io.disconnect();
    };
  }, [mountCanvas, eager]);

  return (
    <div ref={hostRef} data-about-bust-stage="">
      {mountCanvas ? (
        <Suspense fallback={null}>
          <AboutAsciiCanvas eventSource={hostRef} />
        </Suspense>
      ) : null}
    </div>
  );
}
