import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import verticalLoop from "./verticalLoop";
import { scrollDelta } from "./scrollDelta";
import type { RevealChange } from "./Reveal";
import { isMobileLayout, MOBILE_LAYOUT_MQ } from "@/lib/site/isMobileLayout";

gsap.registerPlugin(Observer);

const clamp = gsap.utils.clamp;

const SPEEDS = [1.3, 0.8, 1.15, 0.7, 1.25, 0.85];

/** Shared speed on the phone grid — every cover uses this, applied to the
    image inside the crop rather than the slide, so the centred stack stays even. */
const MOBILE_SPEED = 1.15;

/** Matches the CSS `scale(1.2)` crop on `.gallery_img`. */
const IMAGE_SCALE = 1.2;

/** Extra crop on each side of a scale(1.2) image, as a fraction of wrapper height.
    Displacement is capped here so a pan never shows empty edges. */
const IMAGE_PARALLAX_ROOM = (IMAGE_SCALE - 1) / 2;

/** Strongest deviation from 1× in SPEEDS — normalises the ramp so the fastest
    slide reaches exactly ±cap at the viewport edge and the rest scale under it. */
const MAX_FACTOR = Math.max(...SPEEDS.map((s) => Math.abs(s - 1)));

/** Fraction of the gallery's row gap a single slide may be displaced by.
    Must stay below 0.5 — at 0.5 two neighbours pushed opposite ways would
    exactly close the gap and touch. */
const PARALLAX_CAP_RATIO = 0.45;

type ParallaxItem = {
  el: HTMLElement;
  img: HTMLElement | null;
  factor: number;
  offset: number;
  visible: boolean;
};

type SliderOptions = {
  root?: ParentNode;
  enabled?: () => boolean;
  onToggle?: (changes: RevealChange[], immediate?: boolean) => void;
  /** Fires when the slide nearest the viewport-centred title changes. */
  onCenterChange?: (index: number) => void;
};

/** Infinite slider driven by wheel/touch scrolling */
export default class Slider {
  enabled: () => boolean;
  onToggle?: (changes: RevealChange[], immediate?: boolean) => void;
  onCenterChange?: (index: number) => void;
  root: ParentNode;
  loop!: gsap.core.Timeline;
  wrap!: (value: number) => number;
  parallax!: ParallaxItem[];
  playhead!: { time: number };
  scrub!: gsap.core.Tween;
  observer!: Observer;
  /** Ceiling on a slide's parallax displacement — see applyParallax. */
  private parallaxCap = 0;
  /** Phone grid: uniform image parallax. Desktop: per-slide y. */
  private mobile = false;
  private centerIndex = -1;
  private resizeId?: ReturnType<typeof setTimeout>;
  private resizeSuspended = false;
  private onResize: () => void;
  private mobileMq: MediaQueryList;
  private onMobileMq: () => void;

  constructor({
    root = document,
    enabled = () => true,
    onToggle,
    onCenterChange,
  }: SliderOptions = {}) {
    this.root = root;
    this.enabled = enabled;
    this.onToggle = onToggle;
    this.onCenterChange = onCenterChange;
    this.mobileMq = window.matchMedia(MOBILE_LAYOUT_MQ);
    this.onResize = () => {
      if (this.resizeSuspended) return;
      clearTimeout(this.resizeId);
      this.resizeId = setTimeout(() => this.rebuild(), 200);
    };
    this.onMobileMq = () => this.onResize();

    this.createLoop();
    this.createParallax();
    this.createScrub();
    this.createObserver();
    this.bindResize();
  }

  private slides() {
    return gsap.utils.toArray<HTMLElement>(".gallery_slide", this.root);
  }

  createLoop() {
    const gallery = this.root.querySelector(".gallery") as HTMLElement;
    const gap = parseFloat(getComputedStyle(gallery).rowGap);

    this.loop = verticalLoop(this.slides(), {
      repeat: -1,
      paused: true,
      paddingBottom: gap,
    });

    this.wrap = gsap.utils.wrap(0, this.loop.duration());
  }

  createParallax() {
    this.parallax = this.slides().map((slide) => ({
      el: slide,
      img: slide.querySelector<HTMLElement>(".gallery_img"),
      factor: 0,
      offset: 0,
      visible: false,
    }));

    this.configureParallax();
    this.applyParallax();
  }

  /** Re-derive factors and cap for the current viewport. Desktop keeps the
      per-slide speed list; phones share one factor and pan the image instead. */
  private configureParallax() {
    this.mobile = isMobileLayout();

    const gallery = this.root.querySelector(".gallery") as HTMLElement;
    const gap = parseFloat(getComputedStyle(gallery).rowGap) || 0;
    this.parallaxCap = gap * PARALLAX_CAP_RATIO;

    const factor = this.mobile ? MOBILE_SPEED - 1 : 0;
    this.parallax.forEach((item, i) => {
      item.factor = this.mobile ? factor : SPEEDS[i % SPEEDS.length] - 1;
      item.offset = 0;
    });
  }

  applyParallax(immediate = false) {
    const changes: RevealChange[] = [];
    const viewportMid = window.innerHeight / 2;

    this.parallax.forEach((item) => {
      const rect = item.el.getBoundingClientRect();
      /* On desktop the slide itself carries `y`, so subtract it to recover the
         loop position. On mobile that offset lives on the image; the slide rect
         is already the loop box. */
      const loopTop = this.mobile ? rect.top : rect.top - item.offset;

      /* Offset ramps across the viewport and saturates outside it.

         This used to be `factor * (loopTop + rect.height)` — the slide's
         absolute position scaled by its speed. That grows without bound down
         the gallery: by the last slides it reached ±600px, so a 1.25× slide
         at 2085 landed below a 0.85× slide at 2574 and rendered on top of it.
         It also meant that when the loop wrapped and loopTop jumped by the
         full loop height, the offset teleported by factor × that height —
         a slide leaping ~900px mid-fade, which is what smeared.

         Normalising against half the viewport spends the whole ±cap budget
         over the band you can actually see, instead of hitting the ceiling
         163px from centre and sitting there. Offscreen slides pin at the cap,
         which is what bounds divergence and kills both failures. */
      const fromMid = loopTop + rect.height / 2 - viewportMid;
      const ramp = clamp(-1, 1, fromMid / viewportMid);

      if (this.mobile) {
        const wrapperH =
          item.img?.parentElement?.getBoundingClientRect().height ?? 0;
        const cap = wrapperH * IMAGE_PARALLAX_ROOM;
        item.offset = cap * ramp;
        gsap.set(item.el, { y: 0 });
        if (item.img) {
          gsap.set(item.img, { scale: IMAGE_SCALE, y: item.offset });
        }
      } else {
        item.offset = this.parallaxCap * (item.factor / MAX_FACTOR) * ramp;
        gsap.set(item.el, { y: item.offset });
      }

      const top = this.mobile ? loopTop : loopTop + item.offset;
      const visible = top < window.innerHeight && top + rect.height > 0;

      if (visible !== item.visible) {
        item.visible = visible;
        changes.push({ el: item.el, visible, top });
      }
    });

    if (changes.length) this.onToggle?.(changes, immediate);

    const next = this.centeredIndex;
    if (next !== this.centerIndex) {
      this.centerIndex = next;
      this.onCenterChange?.(next);
    }
  }

  createScrub() {
    this.playhead = { time: 0 };

    this.scrub = gsap.to(this.playhead, {
      time: 0,
      duration: 0.75,
      ease: "power3.out",
      paused: true,
      onUpdate: () => {
        this.loop.time(this.wrap(this.playhead.time));
        this.applyParallax();
      },
    });
  }

  createObserver() {
    this.observer = Observer.create({
      target: window,
      type: "wheel,touch",
      preventDefault: true,
      onChange: (self) => {
        this.scroll(self);
      },
      // Touch + preventDefault swallows the browser click; Observer still
      // fires onClick for a tap that didn't drag, so the project can open.
      onClick: (self) => {
        if (!this.enabled()) return;
        const x = self.x;
        const y = self.y;
        if (x == null || y == null) return;
        const hit = document.elementFromPoint(x, y);
        hit?.closest<HTMLElement>(".gallery_slide")?.click();
      },
    });
  }

  bindResize() {
    window.addEventListener("resize", this.onResize);
    this.mobileMq.addEventListener("change", this.onMobileMq);
  }

  scroll(self: Observer) {
    if (!this.enabled()) return;

    this.scrub.vars.time += scrollDelta(self) / 100;
    this.scrub.invalidate().restart();
  }

  /**
   * Bring slide `index` to the vertical centre of the viewport.
   *
   * Solved by iteration rather than algebra: applyParallax() derives each
   * slide's offset from its *current* rect, so moving the playhead changes
   * the very number you'd need to compute the move. A few passes converge
   * because the parallax factors are small and bounded.
   */
  centerOn(index: number) {
    const el = this.slides()[index];
    if (!el) return;

    for (let pass = 0; pass < 6; pass++) {
      const rect = el.getBoundingClientRect();
      const delta = rect.top + rect.height / 2 - window.innerHeight / 2;
      if (Math.abs(delta) < 1) break;

      // 100px of travel == 1 unit of loop time (verticalLoop's speed default).
      this.playhead.time += delta / 100;
      this.loop.time(this.wrap(this.playhead.time));
      this.applyParallax(true);
    }

    this.scrub.vars.time = this.playhead.time;
    this.scrub.invalidate();
  }

  /** Index of the slide currently nearest the viewport centre. */
  get centeredIndex() {
    const mid = window.innerHeight / 2;
    let closest = Infinity;
    let index = 0;
    this.parallax.forEach((item, i) => {
      const rect = item.el.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - mid);
      if (distance < closest) {
        closest = distance;
        index = i;
      }
    });
    return index;
  }

  /** Hold off the debounced rebuild while a mode switch is in flight — it
      would re-derive geometry from CSS that no longer describes the view. */
  suspendResize(suspended: boolean) {
    this.resizeSuspended = suspended;
    if (suspended) clearTimeout(this.resizeId);
  }

  /**
   * Drop the parallax so a Flip measures loop position rather than loop
   * position plus a ramp that depends on where the slide sits in the viewport.
   * `stop()` is not enough on its own — it disables the Observer and freezes
   * the scrub, but every per-slide offset stays applied.
   */
  neutralise() {
    this.parallax.forEach((item) => {
      item.offset = 0;
      gsap.set(item.el, { y: 0 });
      if (this.mobile && item.img) {
        gsap.set(item.img, { y: 0, scale: IMAGE_SCALE });
      }
    });
  }

  freeze() {
    this.scrub.pause();
    this.scrub.vars.time = this.playhead.time;
    this.scrub.invalidate();
  }

  stop() {
    this.observer.disable();
    this.freeze();
  }

  start() {
    this.observer.enable();
  }

  rebuild() {
    const progress = this.loop.progress();

    this.freeze();
    this.loop.kill();
    gsap.set(this.slides(), { clearProps: "transform" });
    this.parallax.forEach((item) => {
      if (item.img) gsap.set(item.img, { clearProps: "transform" });
    });

    this.createLoop();
    this.loop.progress(progress, true);

    this.configureParallax();
    this.applyParallax(true);

    this.playhead.time = this.loop.time();
    this.scrub.vars.time = this.playhead.time;
    this.scrub.invalidate();
  }

  destroy() {
    window.removeEventListener("resize", this.onResize);
    this.mobileMq.removeEventListener("change", this.onMobileMq);
    clearTimeout(this.resizeId);
    this.observer?.kill();
    this.scrub?.kill();
    this.loop?.kill();
    this.parallax?.forEach((item) => {
      if (item.img) gsap.set(item.img, { clearProps: "transform" });
    });
  }
}
