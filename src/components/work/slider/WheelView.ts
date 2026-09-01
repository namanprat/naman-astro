import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import { scrollDelta } from "./scrollDelta";
import { MOBILE_LAYOUT_MQ } from "@/lib/site/isMobileLayout";
import { ringCopies, ringRadius } from "./wheelGeometry";

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
 * The phone's own, and it has to be looser about packing than the desktop's.
 *
 * Copies come out of `circumference / (projects × tileHeight × ratio)`, rounded.
 * Phone tiles are cards rather than thumbnails, so at 2.13 a tightened ring fell
 * under 1.5 and dropped to a single copy — six positions instead of twelve,
 * which doubles the angular step and leaves nothing sitting on the anchor. At
 * 1.5 the ring keeps its twelve, and the gap that leaves between 62vw cards is
 * still most of a card.
 */
const PHONE_SPACING_RATIO = 1.5;

/**
 * Anchor sits at the top of the circle. Screen y grows downward, so that is
 * −90°. That tile is `.is-centered`; the rest sit desaturated behind it.
 */
const ANCHOR_DEG = -90;

/**
 * The phone puts it at 9 o'clock instead, and pushes the circle's centre off the
 * *right* edge so only its left flank is on screen. With a radius far larger
 * than the viewport, that flank is close to a straight line: the tiles read as a
 * column down the middle rather than a ring, and the anchored one lands on the
 * centre line with room for a marker beside it — `PHONE_CENTER_DROP_VH` then
 * takes it a little below the midpoint.
 *
 * Left flank rather than right, so the column bows away from the marker: the
 * neighbours lean right of centre and the anchored tile is the leftmost point of
 * the arc.
 */
const PHONE_ANCHOR_DEG = 180;
/**
 * Vertical pitch between the anchored card and the one above it, as a multiple
 * of the card's own height. 1.0 would have them touching; the remainder is the
 * gap. The radius follows from it instead of from the viewport.
 *
 * Adjacent tiles are one angular step apart, and across the anchor (9 o'clock)
 * a step moves a tile `r · sin(step)` down the screen — so
 * `r = pitch / sin(step)`. Tiles further round the arc compress, which is the
 * curve doing its job.
 *
 * Deriving it from the tile also pins `syncCopies` at two copies on every
 * phone: `circumference / (projects × tile × ratio)` cancels the tile out and
 * lands at ~1.7 whatever the screen. Off a `vh` radius it sat on a knife edge,
 * and a short-and-wide phone — or Safari's toolbar shrinking `svh` — tipped it
 * to a single copy: six positions instead of twelve, double the gap, and the
 * anchor falling exactly between two cards.
 */
const PHONE_PITCH_RATIO = 1.2;

/** Only until the cards have laid out and can be measured. */
const PHONE_FALLBACK_RADIUS_VH = 0.75;

/**
 * Multiples of the viewport height. The arc's centre sits below the middle of
 * the screen, so the anchored card does too: the nav and the project label take
 * the top of the phone screen and only the view switcher takes the bottom, so a
 * card on the true centre reads high. The marker follows via
 * `--wheel-center-drop` (`Work.css`).
 */
const PHONE_CENTER_DROP_VH = 0.04;

/**
 * Pixels of finger per tile step on a phone, as a multiple of the card's own
 * height. At 1.4 the ring turned about as fast as the finger moved, so a swipe
 * that felt like one card threw three; 2.2 is roughly a card per comfortable
 * swipe.
 */
const PHONE_PX_PER_STEP_RATIO = 2.2;

/** Pixels of wheel per tile step, taken from the reference: it advanced one
    thumbnail per `innerWidth * 0.45` (≈576px at 1280 wide). Held as distance
    rather than degrees so the ring keeps this feel whatever it ends up
    holding — twelve positions today, so ~0.052°/px against the 0.15 this
    started at. Phone uses the tile's own height instead — 576px is a desktop
    wheel constant and a swipe barely turns the ring. */
const PX_PER_STEP = 576;

/** Wheel inertia only. Touch is 1:1 while the finger is down. */
const WHEEL_SCRUB_S = 0.28;

/** Seconds of release velocity applied as a throw, then we snap. */
const COAST_S = 0.22;

/** Settle onto the nearest tile once scrolling stops. */
const SNAP_S = 0.5;
const SNAP_MIN_S = 0.32;
const SNAP_MAX_S = 0.7;
const SNAP_EASE = "power3.out";

/** Below this the ring is close enough that snapping would only read as drift. */
const SNAP_EPSILON_DEG = 0.2;

/** Finger jitter under this is a tap, not a scroll. 1:1 drag used to eat
    every click — Observer saw the noise and skipped `onClick`. */
const TAP_PX = 12;

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
  /** Where on the ring the focused tile sits. Re-read on every measure. */
  private anchorDeg = ANCHOR_DEG;
  /**
   * Which way a scroll turns the ring. The phone's arc is the mirror of the
   * desktop's — centre off the right edge instead of overhead — so the same
   * rotation carries a tile up the screen there and down here. Flipping the
   * sign is what keeps "scroll down, next project" true on both.
   */
  private scrollSign = -1;
  private snapTween: gsap.core.Tween | null = null;
  private resizeId?: ReturnType<typeof setTimeout>;
  private resizeSuspended = false;
  private onResize: () => void;
  /** Last width we measured against. Height-only changes are the iOS toolbar. */
  private lastViewWidth = 0;
  /** Pixels of gesture per tile. Phone re-reads this from the tile height. */
  private pxPerStep = PX_PER_STEP;
  /** Touch is down — `onRelease` snaps; wheel never sets this. */
  private dragging = false;
  /** Absolute gesture travel this press. Under `TAP_PX` we open, not turn. */
  private dragPx = 0;
  /** `100svh` probe — iOS `visualViewport.height` still grows with the toolbar. */
  private svhBox: HTMLDivElement | null = null;

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
      // iOS fires resize when the URL bar shows or hides. Width is unchanged;
      // rebuilding then jumps the ring under the chrome.
      if (this.viewSize().w === this.lastViewWidth) return;
      clearTimeout(this.resizeId);
      this.resizeId = setTimeout(() => this.rebuild(), 200);
    };

    // Cached, not re-queried per frame — the reference ran querySelectorAll
    // over every node inside its rAF loop.
    const originals = gsap.utils.toArray<HTMLElement>(
      ".gallery_slide",
      this.root,
    );
    this.projectCount = originals.length;
    this.originals = originals;
    /* Starts at one copy so `measure` has tiles to read a size from; it then
       derives how many the ring can actually carry and rebuilds if needed. */
    this.tiles = [...originals];

    /* Placeholder: `measure` does not read it, but it decides the anchor and
       how many positions the ring carries, and both go into the seed below. */
    this.rot = { value: 0 };

    this.measure();

    /* Start anchored on the first project. `baseAngle(0)` is 0, so the rotation
       that puts tile 0 on the anchor is the anchor itself. Seeded here rather
       than at the declaration, which ran before `measure` had swapped in the
       phone's anchor and left the ring parked half a step off it — with no
       card under the marker on boot. */
    this.rot.value = this.anchorDeg;
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
  /**
   * Width from the visual viewport; height from a `100svh` probe.
   * `visualViewport.height` / `innerHeight` / `dvh` all grow when Safari
   * hides the URL bar, which is what kept shifting the ring.
   */
  private viewSize() {
    const w = window.visualViewport?.width ?? window.innerWidth;
    if (!this.svhBox) {
      const box = document.createElement("div");
      box.setAttribute("aria-hidden", "true");
      box.style.cssText =
        "position:fixed;inset:0 auto auto 0;width:0;height:100svh;visibility:hidden;pointer-events:none";
      document.body.appendChild(box);
      this.svhBox = box;
    }
    return { w, h: this.svhBox.offsetHeight || window.innerHeight };
  }

  private openAt(x?: number, y?: number) {
    if (x == null || y == null) return;
    const hit = document.elementFromPoint(x, y);
    hit?.closest<HTMLElement>(".gallery_slide")?.click();
  }

  private measure() {
    const phone = window.matchMedia(MOBILE_LAYOUT_MQ).matches;
    const { w, h } = this.viewSize();
    this.lastViewWidth = w;
    this.anchorDeg = phone ? PHONE_ANCHOR_DEG : ANCHOR_DEG;
    this.scrollSign = phone ? 1 : -1;
    this.cx = w / 2;
    this.cy = h / 2;

    /* The ring occupies its diameter plus one tile, since tiles are centred on
       the circle and so hang half a width outside it. Capping on height alone
       let it run off both sides of a phone — 32vh of an 812pt screen is a 520px
       ring on a 375px viewport. Tile width is read rather than hardcoded: it is
       CSS that sets it, and it changes at the breakpoint. */
    const tile = this.tiles[0];
    const tileWidth = tile?.offsetWidth ?? 0;
    const tileHeight = tile?.offsetHeight ?? 0;
    const widthCap = (w - tileWidth) / 2 - EDGE_GUTTER;

    if (phone) {
      /* No width cap: the ring is *meant* to overrun the screen here, and the
         centre goes with it so the anchor at 3 o'clock lands on the middle of
         the viewport. Height is the small/visual viewport, locked by ignoring
         toolbar-only resizes, so the centred tile stays in the visible screen. */
      this.radius = tileHeight
        ? ringRadius(
            tileHeight,
            PHONE_PITCH_RATIO,
            this.projectCount * MAX_COPIES,
          )
        : h * PHONE_FALLBACK_RADIUS_VH;
      this.cx = w / 2 + this.radius;
      this.cy = h / 2 + h * PHONE_CENTER_DROP_VH;
    } else {
      this.radius = Math.max(
        0,
        Math.min(RADIUS, h * RADIUS_VH_CAP, widthCap),
      );
    }

    /* Off the card, not the desktop wheel constant — 576px is most of a phone
       screen and a swipe barely turned the ring. */
    this.pxPerStep = phone
      ? Math.max(tileHeight * PHONE_PX_PER_STEP_RATIO, 1)
      : PX_PER_STEP;

    /* On the page root, not the gallery: the label is a sibling of `.gallery`
       and sizes itself against the ring, so it has to inherit this too. The
       anchor marker inside `.gallery` still picks it up on the way down. */
    const host =
      this.root instanceof HTMLElement
        ? this.root
        : this.root.querySelector<HTMLElement>(".work_wrap");
    host?.style.setProperty("--wheel-radius", `${this.radius}px`);
    /* Published rather than duplicated as a second CSS constant: the marker has
       to sit on the anchored tile, and the anchor is wherever `cy` put it. */
    host?.style.setProperty("--wheel-center-drop", `${this.cy - h / 2}px`);

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

    const ratio = window.matchMedia(MOBILE_LAYOUT_MQ).matches
      ? PHONE_SPACING_RATIO
      : SPACING_RATIO;
    const wanted = ringCopies(
      this.radius,
      this.projectCount,
      tileHeight,
      ratio,
      MAX_COPIES,
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
      const offset = Math.abs(shortest(theta - this.anchorDeg));

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

    this.tiles.forEach((el, i) => {
      el.classList.toggle("is-centered", i === closestIndex);
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
      duration: WHEEL_SCRUB_S,
      ease: "power3.out",
      paused: true,
      onUpdate: () => this.place(),
      // Fires once the inertia has run out, i.e. when scrolling has stopped —
      // which is exactly when the ring should settle onto a tile.
      onComplete: () => this.snap(),
    });
  }

  private degPerPx() {
    return (this.scrollSign * (360 / this.tiles.length)) / this.pxPerStep;
  }

  createObserver() {
    this.observer = Observer.create({
      target: window,
      type: "wheel,touch",
      preventDefault: true,
      onPress: () => {
        if (!this.enabled()) return;
        this.dragging = true;
        this.dragPx = 0;
        this.killSnap();
        this.scrub.pause();
      },
      onChange: (self) => {
        this.scroll(self);
      },
      onRelease: (self) => {
        if (!this.dragging) return;
        this.dragging = false;
        if (!this.enabled()) return;
        // Tap: open here. `onClick` will no-op because dragPx stays under
        // the threshold — Observer often skips it once 1:1 drag has run.
        if (this.dragPx < TAP_PX) {
          this.openAt(self.x, self.y);
          this.dragPx = TAP_PX;
          return;
        }
        this.coast(self);
      },
      onClick: (self) => {
        if (!this.enabled()) return;
        if (this.dragPx >= TAP_PX) return;
        this.openAt(self.x, self.y);
      },
    });
  }

  scroll(self: Observer) {
    if (!this.enabled()) return;

    // A new scroll overrides a settle in progress, or the two fight over `rot`.
    this.killSnap();

    const delta = scrollDelta(self) * this.degPerPx();
    if (self.event?.type === "wheel") {
      this.scrub.vars.value += delta;
      this.scrub.invalidate().restart();
      return;
    }

    // Touch: 1:1. Restarting a 750ms ease on every move was the molasses.
    this.dragPx += Math.abs(scrollDelta(self));
    if (this.dragPx < TAP_PX) return;
    this.rot.value += delta;
    this.scrub.vars.value = this.rot.value;
    this.place();
  }

  private killSnap() {
    this.snapTween?.kill();
    this.snapTween = null;
  }

  /**
   * Nearest rotation that leaves a tile sitting on the anchor.
   *
   * A tile is anchored when `baseAngle(i) + rot === anchorDeg`, so the resting
   * rotations are `anchorDeg − i × step`. Rounding `(rot − anchorDeg) / step`
   * picks whichever of those is closest, which is also always the short way.
   */
  private snapTarget(from: number) {
    const step = 360 / this.tiles.length;
    const anchor = this.anchorDeg;
    return Math.round((from - anchor) / step) * step + anchor;
  }

  /**
   * Finger-up: throw by the release velocity, then land on a tile.
   * A slow lift throws ~0 and just eases to the nearest — a flick coasts.
   */
  private coast(self: Observer) {
    const vx = self.velocityX;
    const vy = self.velocityY;
    const v = Math.abs(vx) > Math.abs(vy) ? vx : vy;
    const throwDeg = -v * this.degPerPx() * COAST_S;
    this.snap(this.rot.value + throwDeg);
  }

  /** Ease the ring onto the tile nearest `from` (current rotation if omitted). */
  private snap(from = this.rot.value) {
    const target = this.snapTarget(from);
    if (Math.abs(target - this.rot.value) < SNAP_EPSILON_DEG) return;

    const step = 360 / Math.max(this.tiles.length, 1);
    const slots = Math.abs(target - this.rot.value) / step;
    const duration = Math.min(
      SNAP_MAX_S,
      Math.max(SNAP_MIN_S, SNAP_S * Math.min(slots, 1.4)),
    );

    this.killSnap();
    this.snapTween = gsap.to(this.rot, {
      value: target,
      duration,
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
      const delta = shortest(this.anchorDeg - this.baseAngle(i) - this.rot.value);
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
    this.dragging = false;
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
    this.svhBox?.remove();
    this.svhBox = null;
    this.observer?.kill();
    this.scrub?.kill();
    this.killSnap();
    gsap.killTweensOf(this.rot);
    // The grid — and the Flip — must find exactly the six React slides again.
    this.originals.forEach((el) => el.classList.remove("is-centered"));
    this.clones.forEach((el) => el.remove());
    this.clones = [];
  }
}
