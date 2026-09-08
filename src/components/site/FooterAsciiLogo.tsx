import { useEffect, useRef } from "react";
import { REDUCED_MOTION_QUERY } from "@/lib/site/util/prefersReducedMotion";
import { FooterAsciiField } from "@/lib/site/ascii/FooterAsciiField";
import "./FooterAsciiLogo.css";

/**
 * Interactive ASCII wordmark — Duforn field with spring push, sampling the
 * `.footer_logo` source SVG. Desktop-only (the parent gates the mount).
 */
export default function FooterAsciiLogo({
  sourceSelector,
}: {
  sourceSelector: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    /* ponytail: the source image is found, not handed in. It used to arrive as
       a React ref from `Footer.tsx`; the footer is Astro now, so the `<img>` is
       server-rendered and there is no ref to pass. */
    const logoImg = document.querySelector<HTMLImageElement>(sourceSelector);
    if (!wrap || !canvas || !logoImg) return;

    /* ponytail: `closest`, not `parentElement`. This component mounts inside an
       `<astro-island>` host, which is a real DOM parent even though it renders
       `display: contents` — so `parentElement` is that host rather than the
       card the field measures against. */
    const box = wrap.closest(".footer_box");
    if (!(box instanceof HTMLElement)) return;

    const reduceMq = window.matchMedia(REDUCED_MOTION_QUERY);
    let field: FooterAsciiField | null = null;
    let disposed = false;

    const stop = () => {
      field?.dispose();
      field = null;
    };

    const start = () => {
      if (disposed || field || reduceMq.matches) return;
      if (!logoImg.complete || logoImg.naturalWidth === 0) return;
      field = new FooterAsciiField(wrap, canvas, logoImg, box, false);
    };

    const onReduce = () => {
      if (reduceMq.matches) stop();
      else start();
    };

    if (logoImg.complete && logoImg.naturalWidth > 0) start();
    else logoImg.addEventListener("load", start, { once: true });

    reduceMq.addEventListener("change", onReduce);

    const ro = new ResizeObserver(() => field?.rebuild());
    ro.observe(wrap);
    ro.observe(logoImg);

    return () => {
      disposed = true;
      stop();
      reduceMq.removeEventListener("change", onReduce);
      ro.disconnect();
    };
  }, [sourceSelector]);

  return (
    <div className="footer_ascii" ref={wrapRef} aria-hidden="true">
      <canvas className="footer_ascii_canvas" ref={canvasRef} />
    </div>
  );
}
