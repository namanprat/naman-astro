/**
 * Boot the footer's ASCII wordmark: desktop only, and only once the footer is
 * near enough to be worth a GPU stage.
 *
 * This is `FooterAsciiStage.tsx` and `FooterAsciiLogo.tsx` with the React
 * removed. Neither was really a component — between them they were a media
 * query, an IntersectionObserver, a `logoImg.complete` check and a
 * ResizeObserver, all of which are the same code without JSX around them.
 *
 * ponytail: the source image is found, not handed in. It used to arrive as a
 * React ref from `Footer.tsx`; the footer has been Astro for a while, so the
 * `<img>` is server-rendered and there is no ref to pass.
 *
 * ponytail: no `closest(".footer_box")` walk any more. The old component
 * mounted inside an `<astro-island>` host — a real DOM parent even though it
 * renders `display: contents` — so `parentElement` was that host rather than
 * the card the field measures against. Without the island there is no host to
 * step over, and the box is passed in from the markup that owns it.
 */
import "./footerAscii.css";
import { MOBILE_LAYOUT_MQ } from "../util/isMobileLayout";
import { REDUCED_MOTION_QUERY } from "../util/prefersReducedMotion";
import { mountWhenNear } from "../webgl/lazyStage";
import { FooterAsciiField } from "./FooterAsciiField";

/** Desktop, stated positively — `mountWhenNear` mounts while its query matches. */
const DESKTOP = `not all and ${MOBILE_LAYOUT_MQ}`;

export function bootFooterAscii(): () => void {
  const wrap = document.querySelector<HTMLElement>("[data-footer-ascii]");
  const logoImg = document.querySelector<HTMLImageElement>(
    ".footer_logo_source",
  );
  const box = wrap?.closest(".footer_box");
  if (!wrap || !logoImg || !(box instanceof HTMLElement)) return () => {};

  const reduceMq = window.matchMedia(REDUCED_MOTION_QUERY);
  let field: FooterAsciiField | null = null;
  let sizeObserver: ResizeObserver | null = null;

  const teardown = mountWhenNear(
    wrap,
    async () => {
      // The field samples the wordmark's pixels, so a decoded image is a
      // precondition, not a nicety — an undecoded one samples to nothing and
      // the field builds an empty lattice.
      if (!logoImg.complete || logoImg.naturalWidth === 0) {
        await new Promise<void>((resolve) => {
          logoImg.addEventListener("load", () => resolve(), { once: true });
          logoImg.addEventListener("error", () => resolve(), { once: true });
        });
      }
      field = await FooterAsciiField.create(
        wrap,
        logoImg,
        box,
        reduceMq.matches,
      );
      // ponytail: observe the image as well as the wrap. The wordmark is an SVG
      // sized by its own container, so it can change size on a breakpoint the
      // wrap does not react to — and every cell's position is derived from
      // where that image lands.
      sizeObserver = new ResizeObserver(() => field?.rebuild());
      sizeObserver.observe(wrap);
      sizeObserver.observe(logoImg);
      return {
        dispose() {
          sizeObserver?.disconnect();
          sizeObserver = null;
          field?.dispose();
          field = null;
        },
      };
    },
    { rootMargin: "50% 0px", media: DESKTOP },
  );

  // Reduced motion is a stylesheet rule too (`.footer_ascii { display: none }`),
  // but the stage has to go as well or a parked GPU context sits behind it.
  const onReduce = () => field?.setReduced(reduceMq.matches);
  reduceMq.addEventListener("change", onReduce);

  return () => {
    reduceMq.removeEventListener("change", onReduce);
    teardown();
  };
}
