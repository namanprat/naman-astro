import { gsap } from "gsap";
import { Observer } from "gsap/Observer";

gsap.registerPlugin(Observer);

/**
 * The circular wheel from `cg-yzavoku-slider` — the view the UI calls "Slider".
 *
 * Tiles orbit a ring about the viewport centre, driven by one shared rotation
 * accumulator. A circle is cyclic by construction, so unlike the grid there is
 * no loop timeline, no wrapping and no cloned DOM: position is pure trig on
 * `rotation`, recomputed each frame.
 *
 * Mirrors `Slider`'s public surface so `WorkGallery` can hold either engine
 * behind one variable and the return-from-project path needs no branching.
 *
 * The reference's horizontal 45vw slide layer — its background interaction —
 * is not ported.
 */

/** The reference's radius, capped so the ring still fits a short viewport. */
const RADIUS = 350;
const RADIUS_VH_CAP = 0.32;

/** Air between the ring's outer edge and the viewport sides. */
const EDGE_GUTTER = 16;

/**
 * How many times each project may repeat around the ring. Two fills a desktop
 * circle; one is all a phone can hold without the tiles touching.
 */
const MAX_COPIES = 2;

/**
 * Arc length each tile wants, as a multiple of its own height. Below this the
 * ring reads as a solid band rather than a set of thumbnails — which is what a
 * fixed twelve positions did on a phone, where the radius is width-capped to
 * about 150px.
 *
 * Held at ~2.13 so a 64px square keeps the same ~136px arc the 91px portrait
 * tiles used at 1.5. Dropping height without this would pack two copies on
 * phones and bring the band of stamps back.
 */
const SPACING_RATIO = 2.13;

/**
 * Anchor sits at the top of the circle. Screen y grows downward, so that is
 * −90°. Nothing about a tile's appearance marks it — like the reference the
 * ring is uniform — it is only which project the label names and which one a
 * click opens.
 */
const ANCHOR_DEG = -90;

/** Pixels of wheel per tile step, taken from the reference: it advanced one
    thumbnail per `innerWidth * 0.45` (≈576px at 1280 wide). Held as distance
    rather than degrees so the ring keeps this feel whatever it ends up
    holding — twelve positions today, so ~0.052°/px against the 0.15 this
    started at. */
const PX_PER_STEP = 576;

/** Settle onto the nearest tile once scrolling stops. Soft and short — it is a
    correction to what you already chose, not a movement of its own. */
const SNAP_S = 0.45;
const SNAP_EASE = "power2.out";

/** Below this the ring is close enough that snapping would only read as drift. */
const SNAP_EPSILON_DEG = 0.2;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Wrap into (−180, 180] so every angular comparison takes the short way. */
const shortest = (deg: number) => (((deg % 360) + 540) % 360) - 180;

type WheelViewOptions = {
  root?: ParentNode;
  enabled?: () => boolean;
  /** Fires when the tile at the anchor changes. */
  onCenterChange?: (index: number) => void;
};

export default class WheelView {
  enabled: () => boolean;
  onCenterChange?: (index: number) => void;
  root: ParentNode;
  /** Unbounded accumulator, like Slider's playhead — never wrapped in storage. */
  rot!: { value: number };
  scrub!: gsap.core.Tween;
  observer!: Observer;
  private tiles: HTMLElement[] = [];
  /** The six React slides, without any ring copies. */
  private originals: HTMLElement[] = [];
  /** Copies currently on the ring — derived per viewport, see `syncCopies`. */
  private copies = 1;
  /** Clones this view added; removed again on destroy so the grid sees six. */
  private clones: HTMLElement[] = [];
  /** How many real projects there are — `tiles.length / COPIES`. */
  private projectCount = 0;
  private centerIndex = -1;
  private cx = 0;
  private cy = 0;
  private radius = RADIUS;
  private snapTween: gsap.core.Tween | null = null;
  private resizeId?: ReturnType<typeof setTimeout>;
  private resizeSuspended = false;
  private onResize: () => void;

  constructor({
    root = document,
    enabled = () => true,
    onCenterChange,
  }: WheelViewOptions = {}) {
    this.root = root;
    this.enabled = enabled;
    this.onCenterChange = onCenterChange;
    this.onResize = () => {
      if (this.resizeSuspended) return;
      clearTimeout(this.resizeId);
      this.resizeId = setTimeout(() => this.rebuild(), 200);
    };

    // Cached, not re-queried per frame — the reference ran querySelectorAll
    // over every node inside its rAF loop.
    const originals = gsap.utils.toArray<HTMLElement>(
      ".gallery__slide",
      this.root,
    );
    this.projectCount = originals.length;
    this.originals = originals;
    /* Starts at one copy so `measure` has tiles to read a size from; it then
       derives how many the ring can actually carry and rebuilds if needed. */
    this.tiles = [...originals];

    /* Start anchored on the first project. At rotation 0 tile 0 sits at 3
       o'clock and the anchor falls between two tiles, so nothing is focused. */
    this.rot = { value: ANCHOR_DEG };

    this.measure();
    this.createScrub();
    this.createObserver();
    this.place();
    window.addEventListener("resize", this.onResize);
  }

  /**
   * Viewport-derived, so re-read on resize — the reference assigned its
   * equivalents once at module scope and desynced from CSS afterwards.
   *
   * JS owns the radius and publishes it as `--wheel-radius` for the CSS anchor
   * marker, rather than the other way round: `getPropertyValue` hands back a
   * custom property's *specified* text, so a `min(350px, 32vh)` authored in CSS
   * comes out as that literal string and `parseFloat` reads NaN.
   */
  private measure() {
    this.cx = window.innerWidth / 2;
    this.cy = window.innerHeight / 2;

    /* The ring occupies its diameter plus one tile, since tiles are centred on
       the circle and so hang half a width outside it. Capping on height alone
       let it run off both sides of a phone — 32vh of an 812pt screen is a 520px
       ring on a 375px viewport. Tile width is read rather than hardcoded: it is
       CSS that sets it, and it changes at the breakpoint. */
    const tile = this.tiles[0];
    const tileWidth = tile?.offsetWidth ?? 0;
    const tileHeight = tile?.offsetHeight ?? 0;
    const widthCap = (window.innerWidth - tileWidth) / 2 - EDGE_GUTTER;

    this.radius = Math.max(
      0,
      Math.min(RADIUS, window.innerHeight * RADIUS_VH_CAP, widthCap),
    );

    /* On the page root, not the gallery: the label is a sibling of `.gallery`
       and sizes itself against the ring, so it has to inherit this too. The
       anchor marker inside `.gallery` still picks it up on the way down. */
    const host =
      this.root instanceof HTMLElement
        ? this.root
        : this.root.querySelector<HTMLElement>(".work-page");
    host?.style.setProperty("--wheel-radius", `${this.radius}px`);

    // Radius first — how many tiles fit is a question about the circumference.
    this.syncCopies(tileHeight);
  }

  /**
   * Six tiles on a wide ring leave big gaps, so each project repeats. The
   * copies are appended in the same order, which puts a project's copies
   * exactly opposite each other — even spacing, no clumping.
   *
   * They are clones rather than extra React nodes so the grid view, the Flip
   * and `Transition` all still see exactly six slides.
   */
  private buildRing(copies: number) {
    const gallery = this.originals[0]?.parentElement;
    if (!gallery) return;

    for (const el of this.clones) el.remove();
    this.clones = [];

    for (let copy = 1; copy < copies; copy++) {
      for (const el of this.originals) {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.dataset.wheelClone = "";
        // Cloned nodes carry no listeners; WorkGallery delegates clicks off
        // `data-index`, and a clone must never be a tab stop of its own.
        clone.removeAttribute("tabindex");
        clone.setAttribute("aria-hidden", "true");
        gallery.appendChild(clone);
        this.clones.push(clone);
      }
    }

    this.copies = copies;
    this.tiles = [...this.originals, ...this.clones];
  }

  /**
   * How many copies the current ring can carry. Derived rather than set per
   * breakpoint: CSS owns the tile size and the radius is already width-capped,
   * so the circumference is the only thing that decides, and it stays right at
   * every width without a second copy of the breakpoint living here.
   */
  private syncCopies(tileHeight: number) {
    if (!tileHeight || !this.projectCount) return;

    const circumference = 2 * Math.PI * this.radius;
    const wanted = Math.min(
      MAX_COPIES,
      Math.max(
        1,
        Math.round(
          circumference / (this.projectCount * tileHeight * SPACING_RATIO),
        ),
      ),
    );
    if (wanted === this.copies) return;

    // Hold the project that was at the anchor across the rebuild — ring indices
    // are about to renumber underneath it.
    const anchored = this.centeredIndex;
    this.buildRing(wanted);
    this.centerIndex = -1;
    if (anchored >= 0) this.centerOn(anchored);
  }

  /** Which project a ring position shows. */
  private projectAt(index: number) {
    return index % this.projectCount;
  }

  private baseAngle(index: number) {
    return (index / this.tiles.length) * 360;
  }

  /** Lay every tile out from the current rotation. */
  place() {
    let closest = Infinity;
    let closestIndex = this.centerIndex;

    this.tiles.forEach((el, i) => {
      const theta = this.baseAngle(i) + this.rot.value;
      const offset = Math.abs(shortest(theta - ANCHOR_DEG));

      gsap.set(el, {
        x: this.cx + this.radius * Math.cos(rad(theta)),
        y: this.cy + this.radius * Math.sin(rad(theta)),
        // The reference placed by top-left and only half-corrected (−25 on y,
        // nothing on x). Centre properly instead.
        xPercent: -50,
        yPercent: -50,
        // Upright all the way round, as the reference does — it rewrites
        // `rotation: 0` every frame so tiles orbit without ever tilting.
        rotation: 0,
        transformOrigin: "center center",
      });

      if (offset < closest) {
        closest = offset;
        closestIndex = i;
      }
    });

    if (closestIndex !== this.centerIndex) {
      this.centerIndex = closestIndex;
      this.onCenterChange?.(this.projectAt(closestIndex));
    }
  }

  /** Project currently at the anchor — not the ring position. */
  get centeredIndex() {
    return this.projectAt(this.centerIndex);
  }

  createScrub() {
    // Seeded from the current rotation, not 0 — otherwise the first wheel event
    // restarts a tween that runs from wherever `vars.value` happened to be and
    // the ring lurches instead of nudging.
    this.scrub = gsap.to(this.rot, {
      value: this.rot.value,
      duration: 0.75,
      ease: "power3.out",
      paused: true,
      onUpdate: () => this.place(),
      // Fires once the inertia has run out, i.e. when scrolling has stopped —
      // which is exactly when the ring should settle onto a tile.
      onComplete: () => this.snap(),
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
      // Same reason as Slider: touch + preventDefault swallows the browser
      // click, but Observer still reports a tap that didn't drag.
      onClick: (self) => {
        if (!this.enabled()) return;
        const x = self.x;
        const y = self.y;
        if (x == null || y == null) return;
        const hit = document.elementFromPoint(x, y);
        hit?.closest<HTMLElement>(".gallery__slide")?.click();
      },
    });
  }

  scroll({ deltaX, deltaY }: { deltaX: number; deltaY: number }) {
    if (!this.enabled()) return;

    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;

    // A new scroll overrides a settle in progress, or the two fight over `rot`.
    this.killSnap();

    // Negative so the ring turns with the scroll rather than against it.
    const degPerPx = -(360 / this.tiles.length) / PX_PER_STEP;

    this.scrub.vars.value += delta * degPerPx;
    this.scrub.invalidate().restart();
  }

  private killSnap() {
    this.snapTween?.kill();
    this.snapTween = null;
  }

  /**
   * Nearest rotation that leaves a tile sitting on the anchor.
   *
   * A tile is anchored when `baseAngle(i) + rot === ANCHOR_DEG`, so the resting
   * rotations are `ANCHOR_DEG − i × step`. Rounding `(rot − ANCHOR_DEG) / step`
   * picks whichever of those is closest, which is also always the short way.
   */
  private snapTarget(from: number) {
    const step = 360 / this.tiles.length;
    return Math.round((from - ANCHOR_DEG) / step) * step + ANCHOR_DEG;
  }

  /** Ease the ring onto the tile it came to rest nearest. */
  private snap() {
    const target = this.snapTarget(this.rot.value);
    if (Math.abs(target - this.rot.value) < SNAP_EPSILON_DEG) return;

    this.killSnap();
    this.snapTween = gsap.to(this.rot, {
      value: target,
      duration: SNAP_S,
      ease: SNAP_EASE,
      onUpdate: () => this.place(),
      onComplete: () => {
        this.snapTween = null;
        // Re-point the scrub or the next wheel event picks up from the
        // pre-snap value and jumps back.
        this.scrub.vars.value = this.rot.value;
        this.scrub.invalidate();
      },
    });
  }

  /**
   * Rotation that brings `project` to the anchor, the short way round.
   *
   * A project sits at several ring positions, so this picks whichever copy is
   * already closest — turning to the far one would spin most of a revolution
   * to land on an identical tile.
   */
  private targetRotation(project: number) {
    let best = Infinity;
    for (let i = project; i < this.tiles.length; i += this.projectCount) {
      const delta = shortest(ANCHOR_DEG - this.baseAngle(i) - this.rot.value);
      if (Math.abs(delta) < Math.abs(best)) best = delta;
    }
    return this.rot.value + (Number.isFinite(best) ? best : 0);
  }

  /** Snap `project` to the anchor. */
  centerOn(index: number) {
    if (index < 0 || index >= this.projectCount) return;
    this.killSnap();
    this.rot.value = this.targetRotation(index);
    this.place();
    this.scrub.vars.value = this.rot.value;
    this.scrub.invalidate();
  }

  freeze() {
    this.killSnap();
    this.scrub.pause();
    this.scrub.vars.value = this.rot.value;
    this.scrub.invalidate();
  }

  stop() {
    this.observer.disable();
    this.freeze();
  }

  start() {
    this.observer.enable();
  }

  /** Hold off the debounced rebuild while a mode switch is in flight — it
      would re-derive geometry from CSS that no longer describes the view. */
  suspendResize(suspended: boolean) {
    this.resizeSuspended = suspended;
    if (suspended) clearTimeout(this.resizeId);
  }

  /** Drop the ring transforms so a Flip measures layout, not layout plus a
      placement that depends on where the tile sits on the circle. */
  neutralise() {
    gsap.set(this.tiles, { clearProps: "transform" });
  }

  rebuild() {
    this.measure();
    this.place();
  }

  destroy() {
    window.removeEventListener("resize", this.onResize);
    clearTimeout(this.resizeId);
    this.observer?.kill();
    this.scrub?.kill();
    this.killSnap();
    gsap.killTweensOf(this.rot);
    // The grid — and the Flip — must find exactly the six React slides again.
    this.clones.forEach((el) => el.remove());
    this.clones = [];
  }
}
