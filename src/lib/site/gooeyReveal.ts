/**
 * The gooey: text that resolves out of a melt, used as the entrance for every
 * heading and as the swap for text that changes in place.
 *
 * The effect is two filters in a fixed order. A CSS `blur()` softens the shape,
 * then `url(#blur-matrix)` — a lone alpha threshold, with no blur of its own —
 * snaps the soft edges back to hard ones, fusing neighbouring glyphs on the way
 * through. Reverse the order and the threshold sees a still-sharp shape, which
 * is a no-op, and you are left with a plain blur rather than a melt.
 *
 * Two layers rather than one filter string: the outer element carries the
 * threshold from CSS and the inner is what GSAP blurs. That keeps a tween to a
 * plain `blur()` on one property, instead of `heroIntro`'s per-frame rewrite of
 * the whole filter string — which it only needs because the wordmark is a
 * masked shape with no font-size to hang an `em` off.
 *
 * Safari (desktop + iOS) cannot reliably apply the SVG `feColorMatrix`
 * threshold to HTML via `filter: url(#…)` — it blanks the element. Soft mode
 * drops the threshold and keeps the blur-to-sharp entrance so copy stays
 * visible. Marked early via `html.is-gooey-soft` (see BaseLayout).
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { prefersReducedMotion } from "./prefersReducedMotion";
import { pollUntil } from "./pollUntil";

gsap.registerPlugin(ScrollTrigger, SplitText);

const TARGETS = "h1, h2, h3";

/**
 * Headings that already have an owner. Each of these is animated by the
 * component that renders it, and a second entrance on the same node either
 * double-animates it or corrupts an existing SplitText.
 *
 * Kept in sync with the `html.is-gooey-arming` rule in `styles/site.css` — the
 * CSS holds these hidden pre-paint, so a target listed in one place and not the
 * other either stays invisible or flashes sharp before it melts.
 *
 * `.manifesto` is deliberately absent: dropping it from the skip list is what
 * moved its lead off the old scrubbed word reveal and onto this one.
 */
const SKIP = [
  ".nav-container",
  ".menu",
  ".footer",
  ".about-panel",
  ".content__group",
  ".transition-panel",
  "[data-no-reveal]",
].join(", ");

/** codegrid's numbers — below ~0.3em the threshold never fuses the glyphs. */
const BLUR_START = "blur(0.35em)";
const BLUR_END = "blur(0em)";
const REVEAL_S = 1.5;
const REVEAL_STAGGER = 0.1;
const REVEAL_START = "top 80%";

/** Blur peak for a swap. Lower than the entrance — it is a shorter beat. */
const MORPH_BLUR = "blur(0.3em)";
const MORPH_S = 0.22;

/** Matches lineReveal: text must never stay hidden if fonts or an island fail. */
const FAILSAFE_MS = 2000;
const POLL_MS = 50;

const ARMING = "is-gooey-arming";
const SOFT = "is-gooey-soft";

/**
 * Apple WebKit without Chromium/Firefox — Safari and iOS WebViews. Those are
 * the engines that blank HTML when `filter: url(#feColorMatrix)` is applied.
 */
export function isSafariGooeyUnsafe(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (!/AppleWebKit/i.test(ua)) return false;
  // Chrome, Edge, Firefox iOS, Opera all include AppleWebKit in their UA.
  return !/Chrome|CriOS|Chromium|Edg|Firefox|FxiOS|Opera|OPR/i.test(ua);
}

/**
 * Soft mode: blur-to-sharp only, no SVG threshold. Forced on Safari; also
 * when the filter node is missing so we never point `url()` at nothing.
 */
export function usesSoftGooey(): boolean {
  if (isSafariGooeyUnsafe()) return true;
  if (typeof document !== "undefined") {
    if (document.documentElement.classList.contains(SOFT)) return true;
  }
  return false;
}

/**
 * Blur first, threshold second — see the module note. Shared with `heroIntro`,
 * which applies both halves to one element, so the ordering rule lives here
 * rather than being spelled out in two places. Soft mode omits the threshold
 * so Safari never gets a blanking `url(#blur-matrix)`.
 */
export function gooeyFilter(px: number): string {
  if (usesSoftGooey() || !hasThreshold()) return `blur(${px}px)`;
  return `blur(${px}px) url(#blur-matrix)`;
}

/**
 * `<GooeyFilter />` renders the threshold once per document. Pointing a
 * `filter: url()` at a node that isn't there doesn't degrade to "no filter" —
 * on WebKit it blanks the element — so every entry point checks first.
 */
function hasThreshold(): boolean {
  return !!document.getElementById("blur-matrix");
}

function canPrepareGooey(): boolean {
  if (prefersReducedMotion()) return false;
  // Soft path only needs CSS blur — the SVG node is optional.
  if (usesSoftGooey()) return true;
  return hasThreshold();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Move a line's children into a span, so the line can hold the threshold
 *  while its inner takes the animated blur. */
function wrapInner(line: Element): HTMLElement {
  const inner = document.createElement("span");
  inner.className = "gooey-reveal__inner";
  while (line.firstChild) inner.appendChild(line.firstChild);
  line.appendChild(inner);
  return inner;
}

export type GooeyTarget = {
  el: HTMLElement;
  inners: HTMLElement[];
};

const registry = new WeakMap<HTMLElement, GooeyTarget>();

function gooeyClass(el: HTMLElement): "gooey-reveal" | "gooey-reveal--soft" {
  if (usesSoftGooey() || el.dataset.reveal === "soft") {
    return "gooey-reveal--soft";
  }
  return "gooey-reveal";
}

function innersOf(target: GooeyTarget | GooeyTarget[]): HTMLElement[] {
  return (Array.isArray(target) ? target : [target]).flatMap((t) => t.inners);
}

function settleGooey(target: GooeyTarget): void {
  target.el.classList.remove("gooey-reveal", "gooey-reveal--soft");
  gsap.set(target.inners, { clearProps: "filter" });
}

/** Split once. Safe to call again — returns the cached target. */
export function prepareGooey(el: HTMLElement): GooeyTarget | null {
  const cached = registry.get(el);
  if (cached) return cached;
  if (!canPrepareGooey()) return null;

  el.dataset.gooey = "";
  const split = SplitText.create(el, {
    type: "lines",
    linesClass: "gooey-reveal__line",
    aria: "auto",
  });
  const target: GooeyTarget = { el, inners: split.lines.map(wrapInner) };
  registry.set(el, target);
  return target;
}

export function prepareGooeyAll(els: Iterable<HTMLElement>): GooeyTarget[] {
  const out: GooeyTarget[] = [];
  for (const el of els) {
    const target = prepareGooey(el);
    if (target) out.push(target);
  }
  return out;
}

export function parkGooey(target: GooeyTarget | GooeyTarget[]): void {
  const list = Array.isArray(target) ? target : [target];
  for (const t of list) {
    t.el.classList.add(gooeyClass(t.el));
    gsap.set(t.inners, { filter: BLUR_START });
  }
}

export function addGooeyReveal(
  tl: gsap.core.Timeline,
  target: GooeyTarget | GooeyTarget[],
  position?: string | number,
): void {
  const list = Array.isArray(target) ? target : [target];
  const inners = innersOf(target);
  if (!inners.length) return;
  tl.to(
    inners,
    {
      filter: BLUR_END,
      duration: REVEAL_S,
      ease: "power3.out",
      stagger: REVEAL_STAGGER,
      onComplete: () => {
        for (const t of list) settleGooey(t);
      },
    },
    position,
  );
}

export function addGooeyUnreveal(
  tl: gsap.core.Timeline,
  target: GooeyTarget | GooeyTarget[],
  position?: string | number,
): void {
  const list = Array.isArray(target) ? target : [target];
  const inners = innersOf(target);
  if (!inners.length) return;
  for (const t of list) {
    t.el.classList.add(gooeyClass(t.el));
    gsap.set(t.inners, { filter: BLUR_END });
  }
  tl.to(
    inners,
    {
      filter: BLUR_START,
      duration: 0.7,
      ease: "power3.in",
      stagger: { each: REVEAL_STAGGER, from: "end" },
    },
    position,
  );
}

function queryHeadings(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(TARGETS)).filter(
    (el) => !el.closest(SKIP) && el.dataset.gooey === undefined,
  );
}

function armHeading(el: HTMLElement): void {
  const target = prepareGooey(el);
  if (!target) return;
  parkGooey(target);
  gsap.to(target.inners, {
    filter: BLUR_END,
    duration: REVEAL_S,
    ease: "power3.out",
    stagger: REVEAL_STAGGER,
    scrollTrigger: { trigger: el, start: REVEAL_START, once: true },
    onComplete: () => settleGooey(target),
  });
}

/**
 * Arm every unowned heading in the document. Runs once per load — the site uses
 * hard navigation, so there is no route change to re-arm on.
 */
export async function bootGooeyHeadings(): Promise<void> {
  const root = document.documentElement;
  const done = () => root.classList.remove(ARMING);

  if (prefersReducedMotion()) return done();
  if (!canPrepareGooey()) return done();

  // Belt-and-suspenders with the inline BaseLayout probe — islands may boot
  // before that script if the markup order ever drifts.
  if (usesSoftGooey()) root.classList.add(SOFT);

  let expired = false;
  const failsafe = setTimeout(() => {
    expired = true;
    done();
  }, FAILSAFE_MS);

  try {
    await Promise.race([document.fonts.ready, wait(FAILSAFE_MS)]);

    // `client:only` islands — the whole home page, work, archive — mount after
    // this module runs, so the headings often aren't in the DOM yet.
    const heads = await pollUntil(queryHeadings, {
      deadline: performance.now() + FAILSAFE_MS,
      intervalMs: POLL_MS,
    });

    // Past the deadline the headings are already on screen; parking them at a
    // blur now would melt copy the reader has been looking at.
    if (!heads.length || expired) return done();

    for (const el of heads) armHeading(el);
    done();
  } catch {
    done();
  } finally {
    clearTimeout(failsafe);
  }
}

/**
 * Swap text that changes in place: blur up, run `swap` at the peak — where the
 * threshold has fused the glyphs into blobs and the old string is unreadable —
 * then blur back down onto the new one.
 *
 * Returns the timeline so the caller can kill an in-flight morph and retarget.
 */
export function gooeyMorph(
  inner: HTMLElement,
  swap: () => void,
): gsap.core.Timeline | null {
  if (prefersReducedMotion() || !canPrepareGooey()) {
    swap();
    return null;
  }

  return gsap
    .timeline()
    .to(inner, {
      filter: MORPH_BLUR,
      duration: MORPH_S,
      ease: "power2.in",
      onComplete: swap,
    })
    .to(inner, { filter: BLUR_END, duration: MORPH_S, ease: "power2.out" });
}
