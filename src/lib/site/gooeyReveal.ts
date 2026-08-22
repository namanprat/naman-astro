/**
 * The gooey: text that resolves out of a melt, used as the entrance for every
 * heading and as the swap for text that changes in place.
 *
 * The effect is two filters in a fixed order. A CSS `blur()` softens the shape,
 * then `url(#blur-matrix)` snaps the soft edges back to hard ones, fusing
 * neighbouring glyphs on the way through. Reverse the order and the threshold
 * sees a still-sharp shape, which is a no-op, and you are left with a plain blur
 * rather than a melt.
 *
 * Both halves sit on one element — the line's `.gooey-reveal__inner` — and the
 * chain is declared once in `styles/site.css`. It used to be split in two, the
 * heading carrying the threshold and its inners carrying the animated blur, but
 * WebKit never GPU-accelerates a reference filter, so that split fed a
 * composited texture into a software filter pass and Safari lost the threshold
 * altogether. See the note on the rule in `site.css`.
 *
 * That leaves the problem the split was solving: GSAP cannot interpolate a
 * `filter` string containing a `url()`. So GSAP tweens `--gooey-blur` instead —
 * a registered custom property the CSS interpolates into the chain — which keeps
 * stagger, easing and timeline positions working exactly as a plain property
 * tween, and means `heroIntro`'s per-frame rewrite of the whole filter string
 * goes away too.
 *
 * Blur radii are authored as em ratios but resolved to px here, at park time,
 * against each element's own font-size. Two reasons: on an engine without
 * `@property` support GSAP would tween `0.35em → 0px` as bare numbers and emit
 * the end unit, silently jumping to `0.35px` on the first frame; and px is the
 * only form that works for the wordmark, which is a masked shape with no
 * font-size to hang an `em` off.
 *
 * Soft mode — `html.is-gooey-soft`, or `data-reveal="soft"` per element — drops
 * the threshold and keeps the blur-to-sharp entrance. It exists for faces too
 * thin to survive the cut, as the automatic fallback when `#blur-matrix` is
 * missing, and as the site-wide escape hatch if a browser turns out not to
 * manage the threshold at all. It is not armed by UA detection.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { prefersReducedMotion } from "./prefersReducedMotion";
import { pollUntil, REVEAL_FAILSAFE_MS, REVEAL_POLL_MS } from "./pollUntil";

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

/** The property `site.css` interpolates into the filter chain. */
export const GOOEY_BLUR_VAR = "--gooey-blur";

/** codegrid's numbers — below ~0.3em the threshold never fuses the glyphs. */
const BLUR_START_EM = 0.35;
const BLUR_END = "0px";
const REVEAL_S = 1.5;
const REVEAL_STAGGER = 0.1;
const REVEAL_START = "top 80%";

/** Blur peak for a swap. Lower than the entrance — it is a shorter beat. */
const MORPH_BLUR_EM = 0.3;
const MORPH_S = 0.22;

const ARMING = "is-gooey-arming";
const SOFT = "is-gooey-soft";

/**
 * Soft mode: blur-to-sharp only, no SVG threshold. Set by `BaseLayout`'s
 * pre-paint script as an explicit opt-out, and by `markGooeySupport` when the
 * filter node is missing so we never point `url()` at nothing.
 */
export function usesSoftGooey(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(SOFT);
}

/**
 * Resolve an em ratio against an element's own font-size — see the module note
 * on why nothing on the wire is in `em`. Falls back to a 16px root if the
 * element has no usable computed size yet.
 */
export function blurPx(el: Element, em: number): string {
  const fontSize = parseFloat(getComputedStyle(el).fontSize);
  return `${(Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16) * em}px`;
}

/**
 * GSAP function-based value: each inner resolves against its own font-size,
 * which matters for the hand-built targets in `Footer` that span differently
 * sized elements.
 */
const BLUR_START = (_i: number, el: Element) => blurPx(el, BLUR_START_EM);

/** Park a blur radius. `heroIntro` resolves `0.450em` to px first so GSAP
 *  never has to interpolate an `em` string on engines without `@property`. */
export function setGooeyBlur(el: HTMLElement, value: number | string): void {
  el.style.setProperty(
    GOOEY_BLUR_VAR,
    typeof value === "number" ? `${value}px` : value,
  );
}

export function clearGooeyBlur(el: HTMLElement): void {
  el.style.removeProperty(GOOEY_BLUR_VAR);
}

/**
 * `<GooeyFilter />` renders the threshold once per document. Pointing a
 * `filter: url()` at a node that isn't there doesn't degrade to "no filter" —
 * on WebKit it blanks the element — so every entry point checks first.
 */
function hasThreshold(): boolean {
  return !!document.getElementById("blur-matrix");
}

/**
 * Route the whole document to the soft chain when `#blur-matrix` is missing.
 *
 * The per-target fallback in `gooeyClass` only covers targets that go through
 * park/arm. `.gallery-label` carries `.gooey-reveal` statically in JSX, so
 * without this its filter list would still name a `url()` that resolves to
 * nothing — which on WebKit blanks the element rather than degrading. One class
 * on the root closes that off for every consumer at once.
 */
function markGooeySupport(): void {
  if (!hasThreshold()) document.documentElement.classList.add(SOFT);
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

/** Move a line's children into a span. The inner is what carries the filter
 *  chain and the animated blur; the line itself stays unfiltered. */
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

/**
 * The one place that decides whether a target gets the threshold or just the
 * blur. A missing `#blur-matrix` routes here rather than cancelling the reveal,
 * so the entrance still runs — soft — instead of not running at all. Any future
 * capability bail-out belongs here too.
 */
function gooeyClass(el: HTMLElement): "gooey-reveal" | "gooey-reveal--soft" {
  if (usesSoftGooey() || el.dataset.reveal === "soft" || !hasThreshold()) {
    return "gooey-reveal--soft";
  }
  return "gooey-reveal";
}

function innersOf(target: GooeyTarget | GooeyTarget[]): HTMLElement[] {
  return (Array.isArray(target) ? target : [target]).flatMap((t) => t.inners);
}

/** Drop the threshold class and clear blur once a reveal has landed sharp.
 *  Explicit `removeProperty` rather than `clearProps`: no ambiguity about how
 *  GSAP clears a custom property, and it sweeps the inline `filter` too. */
export function settleGooey(target: GooeyTarget | GooeyTarget[]): void {
  const list = Array.isArray(target) ? target : [target];
  for (const t of list) {
    t.el.classList.remove("gooey-reveal", "gooey-reveal--soft");
    for (const inner of t.inners) {
      inner.style.removeProperty(GOOEY_BLUR_VAR);
      inner.style.removeProperty("filter");
    }
  }
}

/** Put the threshold class back without parking blur — used before reversing a
 *  settled reveal so the melt still has both filter halves. */
export function armGooey(target: GooeyTarget | GooeyTarget[]): void {
  const list = Array.isArray(target) ? target : [target];
  for (const t of list) {
    t.el.classList.add(gooeyClass(t.el));
  }
}

/** Split once. Safe to call again — returns the cached target. */
export function prepareGooey(el: HTMLElement): GooeyTarget | null {
  const cached = registry.get(el);
  if (cached) return cached;
  // `canPrepareGooey` allows a missing `#blur-matrix` through when soft mode is
  // on, because `gooeyClass` then falls back to the blur-only variant and the
  // entrance still runs rather than being cancelled.
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
    gsap.set(t.inners, { [GOOEY_BLUR_VAR]: BLUR_START });
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
      [GOOEY_BLUR_VAR]: BLUR_END,
      duration: REVEAL_S,
      ease: "power3.out",
      stagger: REVEAL_STAGGER,
      onComplete: () => {
        settleGooey(list);
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
    gsap.set(t.inners, { [GOOEY_BLUR_VAR]: BLUR_END });
  }
  tl.to(
    inners,
    {
      [GOOEY_BLUR_VAR]: BLUR_START,
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
    [GOOEY_BLUR_VAR]: BLUR_END,
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

  // Routes the document to the soft chain if the filter node is missing, so the
  // entrance still runs — blur-only — rather than being skipped outright. Has to
  // come first: `canPrepareGooey` reads the flag it sets.
  markGooeySupport();
  if (prefersReducedMotion()) return done();
  if (!canPrepareGooey()) return done();

  let expired = false;
  const failsafe = setTimeout(() => {
    expired = true;
    done();
  }, REVEAL_FAILSAFE_MS);

  try {
    await Promise.race([document.fonts.ready, wait(REVEAL_FAILSAFE_MS)]);

    // `client:only` islands — the whole home page, work, archive — mount after
    // this module runs, so the headings often aren't in the DOM yet.
    const heads = await pollUntil(queryHeadings, {
      deadline: performance.now() + REVEAL_FAILSAFE_MS,
      intervalMs: REVEAL_POLL_MS,
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

  // Recomputed per call: the label's font-size is both breakpoint- and
  // view-dependent, so a value cached at mount would be wrong after a resize or
  // a slider/grid swap.
  const peak = blurPx(inner, MORPH_BLUR_EM);

  return gsap
    .timeline()
    .to(inner, {
      [GOOEY_BLUR_VAR]: peak,
      duration: MORPH_S,
      ease: "power2.in",
      onComplete: swap,
    })
    .to(inner, {
      [GOOEY_BLUR_VAR]: BLUR_END,
      duration: MORPH_S,
      ease: "power2.out",
    });
}
