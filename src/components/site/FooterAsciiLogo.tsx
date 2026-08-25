import { useEffect, useRef, type RefObject } from "react";
import { REDUCED_MOTION_QUERY } from "@/lib/site/prefersReducedMotion";
import { FooterAsciiField } from "@/lib/site/ascii/FooterAsciiField";
import "./FooterAsciiLogo.css";

/**
 * Interactive ASCII wordmark — Duforn field with spring push, sampling the
 * `.footer_logo` source SVG. Desktop-only (the parent gates the mount).
 */
export default function FooterAsciiLogo({
  sourceRef,
}: {
  sourceRef: RefObject<HTMLImageElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const logoImg = sourceRef.current;
    if (!wrap || !canvas || !logoImg) return;

    const box = wrap.parentElement;
    if (!box) return;

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
  }, [sourceRef]);

  return (
    <div className="footer_ascii" ref={wrapRef} aria-hidden="true">
      <canvas className="footer_ascii_canvas" ref={canvasRef} />
    </div>
  );
}
