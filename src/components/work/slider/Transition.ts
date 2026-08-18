import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(Flip, SplitText);

type TransitionState = "closed" | "opening" | "open" | "closing";

/* Open and close are mirror images, and everything below is derived from the
   morph — MORPH_DURATION is the single speed knob for the whole transition. */
const MORPH_DURATION = 0.85;
const MORPH_EASE = "power4.inOut";

/* The image scale outlasts the box by ~15%. The crop keeps easing for a beat
   after the frame has landed, which reads as weight instead of a rigid morph. */
const SCALE_DURATION = MORPH_DURATION * 1.15;
const SCALE_EASE = "power2.out";

/* power4.inOut has travelled ~90% of the distance by 0.85 of its duration, so
   the copy lands against a settling box rather than a moving one. */
const COPY_START = MORPH_DURATION * 0.62;

/* Body lines rising out of their mask — the only copy that animates now that
   the title holds still. */
const BODY_LINE_DURATION = MORPH_DURATION * 0.8;
const BODY_LINE_STEP = 0.06;

/* Sibling slides clearing / returning. */
const FADE_DURATION = MORPH_DURATION * 0.45;

/* Beat 1: the stage clears before anything morphs. Every tile but the one you
   picked shrinks away, nearest-first, so the ring (or the column) reads as
   opening outward from your choice rather than blinking off.
   `amount`, not `each` — the ring has eleven others and the grid five, and the
   beat has to take the same time either way. */
const EXIT_DURATION = 0.32;
const EXIT_SPREAD = 0.14;
const EXIT_SCALE = 0.6;
const EXIT_EASE = "power2.in";

/* Copy clears before the box starts travelling back. */
const CLOSE_MORPH_DELAY = 0.08;

/* Ceiling on the preview decode. Long enough for a cached image, short
   enough that a stalled decode is never felt. */
const DECODE_TIMEOUT = 120;

type TransitionOptions = {
  root?: ParentNode;
  onClose?: () => void;
  onOpenComplete?: (slug: string) => void;
  /** Optional prep before Flip close (e.g. reset overlay scroll). */
  onBeforeClose?: () => Promise<void>;
};

/** Image-to-content Flip transition */
export default class Transition {
  onClose?: () => void;
  onOpenComplete?: (slug: string) => void;
  onBeforeClose?: () => Promise<void>;
  root: ParentNode;
  content: HTMLElement;
  preview: HTMLElement | null = null;
  previewImg: HTMLImageElement | null = null;
  groups: HTMLElement[];
  activeSlide: HTMLElement | null = null;
  activeSlug: string | null = null;
  tl: gsap.core.Timeline | null = null;
  splitBody: SplitText | null = null;
  state: TransitionState = "closed";

  constructor({
    root = document,
    onClose,
    onOpenComplete,
    onBeforeClose,
  }: TransitionOptions = {}) {
    this.root = root;
    this.onClose = onClose;
    this.onOpenComplete = onOpenComplete;
    this.onBeforeClose = onBeforeClose;

    const content = root.querySelector<HTMLElement>(".content");
    if (!content) throw new Error("Transition: .content element not found");
    this.content = content;
    this.groups = gsap.utils.toArray<HTMLElement>(".content__group", root);
  }

  async open(slide: HTMLElement, index: number) {
    if (this.state !== "closed") return;
    this.state = "opening";
    this.activeSlide = slide;
    this.activeSlug = slide.dataset.slug || null;

    await this.fillContent(slide, index);

    if (this.state !== "opening") return;
    if (!this.preview || !this.previewImg) {
      this.reset();
      return;
    }

    const preview = this.preview;
    const previewImg = this.previewImg;

    const { wrapper, others } = this.parts();

    /* Beat 1: the stage clears, and the morph only starts once it has. Awaited
       rather than offset inside the timeline below, so every constant there
       stays relative to the morph exactly as authored. GSAP tweens are
       thenable, so the tween *is* the await.

       `work-project-open` goes on here rather than after: the label and the
       view switcher are part of the stage, and their CSS opacity transitions
       hang off this class. Set later they'd still be up while the tiles left.
       It is also what turns the nav into BACK, which is the right affordance
       the moment you pick a project. */
    document.documentElement.classList.add("work-transitioning");
    document.documentElement.classList.add("work-project-open");
    await gsap.to(this.byDistanceFrom(slide, others), {
      scale: EXIT_SCALE,
      autoAlpha: 0,
      duration: EXIT_DURATION,
      ease: EXIT_EASE,
      stagger: { amount: EXIT_SPREAD },
    });

    // close() may have superseded us mid-clear.
    if (this.state !== "opening") return;

    wrapper.dataset.flipId = "preview";

    const state = Flip.getState(wrapper);

    gsap.set(this.content, { display: "block" });
    this.content.setAttribute("aria-hidden", "false");
    // The overlay is on screen now, so the label hands off to the title in this
    // same frame. See the `work-morphing` rule in Work.css.
    document.documentElement.classList.add("work-morphing");
    gsap.killTweensOf(wrapper);
    gsap.set(wrapper, { autoAlpha: 0 });
    gsap.set(preview, { autoAlpha: 1 });
    gsap.set(previewImg, { scale: 1.2 });

    // Measured while the cover is still in flow at its natural size — that is
    // the height the row has to keep once Flip pulls it out.
    this.lockCoverRow();

    /* The case study arrives with the cover, not before it. Previously every
       block was at full opacity the instant `.content` displayed, so the page
       appeared fully formed underneath a still-travelling image. */
    const parts = this.contentParts();
    gsap.set(parts, { autoAlpha: 0 });

    /* Only the body is split. The title is deliberately untouched — it occupies
       the same box as the gallery label it replaces, so animating it is what
       made it read as re-entering instead of never having moved. */
    const active = ".content__group.active ";

    this.splitBody = new SplitText(active + ".project__body", {
      type: "lines",
      mask: "lines",
    });

    this.tl = gsap
      .timeline({
        onComplete: () => {
          this.state = "open";
          this.unlockCoverRow();
          document.documentElement.classList.remove("work-transitioning");
          if (this.activeSlug) this.onOpenComplete?.(this.activeSlug);
        },
        onReverseComplete: () => this.reset(),
      })
      .add(
        Flip.from(state, {
          targets: preview,
          duration: MORPH_DURATION,
          ease: MORPH_EASE,
          absolute: true,
        }) as gsap.core.Timeline,
        0,
      )
      .to(
        previewImg,
        { scale: 1, duration: SCALE_DURATION, ease: SCALE_EASE },
        0,
      );

    // Lands against a settling box rather than a moving one.
    this.tl.from(
      this.splitBody.lines,
      {
        yPercent: 110,
        duration: BODY_LINE_DURATION,
        ease: "power3.out",
        stagger: BODY_LINE_STEP,
      },
      COPY_START,
    );

    this.tl.to(
      parts,
      { autoAlpha: 1, duration: FADE_DURATION, ease: "power2.out" },
      COPY_START,
    );

    /* Rises from the label's spot to its own, on the morph's clock and easing,
       so title and cover read as one gesture rather than two. Measured after
       `.content` is displayed — before that the title has no layout position to
       travel from. */
    /* Only where the title actually has somewhere to go. Above 64rem it rests
       dead-centre — exactly where the label was — so the offset is ~0 and there
       is nothing to animate. Skipping rather than tweening by zero also keeps
       GSAP off its `translate(-50%, -50%)`: taking ownership of a percentage
       transform is what strands elements, as `AboutPanel.css` already notes. */
    const title = this.activeTitle();
    const offset = title ? this.titleOffset(title) : 0;
    if (title && Math.abs(offset) > 1) {
      this.tl.from(
        title,
        { y: offset, duration: MORPH_DURATION, ease: MORPH_EASE },
        0,
      );
    }
  }

  /**
   * Land in the open state with no enter animation, so `close()` has something
   * to reverse. Used when arriving at `/work` from a hard-loaded project page:
   * the preview picks up the same 4-col cover the project page occupied, so the
   * reverse starts from exactly where the previous document left off.
   */
  async snapOpen(slide: HTMLElement, index: number) {
    if (this.state !== "closed") return;

    this.state = "opening";
    this.activeSlide = slide;
    this.activeSlug = slide.dataset.slug || null;

    await this.fillContent(slide, index);
    if (this.state !== "opening") return;
    if (!this.preview || !this.previewImg) {
      this.reset();
      return;
    }

    const { wrapper, others } = this.parts();
    wrapper.dataset.flipId = "preview";

    gsap.set(this.content, { display: "block" });
    this.content.setAttribute("aria-hidden", "false");
    gsap.killTweensOf(wrapper);
    gsap.set(wrapper, { autoAlpha: 0 });
    // Parked where a real open's clear beat would have left them, so the close
    // below has the same distance to bring them back.
    gsap.set(others, { autoAlpha: 0, scale: EXIT_SCALE });
    // Two calls: clearProps is applied last within a set, so folding
    // autoAlpha into the same object would wipe it again.
    gsap.set(this.preview, { clearProps: "all" });
    gsap.set(this.preview, { autoAlpha: 1 });
    gsap.set(this.previewImg, { clearProps: "all" });
    gsap.set(this.previewImg, { scale: 1 });
    document.documentElement.classList.add("work-project-open");
    document.documentElement.classList.add("work-morphing");

    const active = ".content__group.active ";

    this.splitBody = new SplitText(active + ".project__body", {
      type: "lines",
      mask: "lines",
    });

    gsap.set(this.splitBody.lines, { yPercent: 0 });

    this.state = "open";
  }

  async close() {
    if (this.state === "opening") {
      this.state = "closing";

      if (!this.tl) {
        this.reset();
        return;
      }

      this.tl.reverse();
      return;
    }

    if (this.state !== "open") return;
    this.state = "closing";

    if (this.onBeforeClose) {
      await this.onBeforeClose();
    }

    // Close may have been superseded while awaiting overlay rewind.
    if (this.state !== "closing") return;
    if (!this.preview || !this.previewImg) {
      this.reset();
      return;
    }

    const preview = this.preview;
    const previewImg = this.previewImg;

    const { wrapper, others } = this.parts();

    gsap.set(preview, { autoAlpha: 1 });
    document.documentElement.classList.add("work-transitioning");

    // Pinned again for the trip home — Flip.fit takes the cover out of flow the
    // same way Flip.from does.
    this.lockCoverRow();

    const bodyLines = this.splitBody?.lines ?? [];

    /* Same guard as the open: zero on desktop, where the title never left the
       label's box. `0` is falsy, which is exactly the "don't tween" case. */
    const closingTitle = this.activeTitle();
    const rawOffset = closingTitle ? this.titleOffset(closingTitle) : 0;
    const closingTitleOffset = Math.abs(rawOffset) > 1 ? rawOffset : 0;

    this.tl = gsap
      .timeline({ onComplete: () => this.reset() })
      // Body leaves the way it arrived — back down behind its mask.
      .to(
        bodyLines,
        {
          yPercent: 110,
          duration: FADE_DURATION,
          stagger: 0.03,
          ease: "power2.in",
        },
        0,
      )
      // The rest of the case study goes with it, and is gone before the cover
      // starts travelling — otherwise the whole project sits there through the
      // entire close.
      .to(
        this.contentParts(),
        { autoAlpha: 0, duration: FADE_DURATION, ease: "power2.in" },
        0,
      )
      .add(
        Flip.fit(preview, wrapper, {
          duration: MORPH_DURATION,
          ease: MORPH_EASE,
          absolute: true,
        }) as gsap.core.Tween,
        CLOSE_MORPH_DELAY,
      )
      // Back down to the label's spot on the same clock, so the gallery label
      // it hands off to is already in that exact box when it reappears.
      .to(
        closingTitleOffset ? closingTitle! : [],
        closingTitleOffset
          ? {
              y: closingTitleOffset,
              duration: MORPH_DURATION,
              ease: MORPH_EASE,
            }
          : {},
        CLOSE_MORPH_DELAY,
      )
      .to(
        previewImg,
        { scale: 1.2, duration: SCALE_DURATION, ease: SCALE_EASE },
        CLOSE_MORPH_DELAY,
      )
      // Mirror of the clear beat: the view unfolds back out from the tile the
      // box just landed on, and only once it has landed.
      .to(
        this.byDistanceFrom(this.activeSlide!, others),
        {
          scale: 1,
          autoAlpha: 1,
          duration: EXIT_DURATION,
          ease: "power2.out",
          stagger: { amount: EXIT_SPREAD },
        },
        CLOSE_MORPH_DELAY + MORPH_DURATION,
      );
  }

  async fillContent(slide: HTMLElement, index: number) {
    const img = slide.querySelector<HTMLImageElement>(".gallery__img");
    if (!img) return;

    this.groups.forEach((group) => {
      const active = Number(group.dataset.index) === index;
      group.classList.toggle("active", active);
    });

    const activeGroup = this.groups.find((group) =>
      group.classList.contains("active"),
    );
    this.preview =
      activeGroup?.querySelector<HTMLElement>("[data-project-preview]") ?? null;
    this.previewImg = this.preview?.querySelector("img") ?? null;
    if (this.preview) this.preview.dataset.flipId = "preview";

    if (this.previewImg) {
      this.previewImg.src = img.currentSrc || img.src;
      this.previewImg.alt = img.alt;
    }

    if (!this.previewImg) return;

    /* decode() is an optimisation — it avoids handing Flip an undecoded
       image — so it must never gate the transition. In a backgrounded
       document it never settles at all, even for a fully loaded image
       (complete: true, naturalWidth set), which would hang open() forever
       and strand the gallery with its slider stopped. Cap it. */
    await Promise.race([
      this.previewImg.decode().catch(() => {
        // Rejects if the src is swapped mid-flight; the transition still runs
      }),
      new Promise((resolve) => setTimeout(resolve, DECODE_TIMEOUT)),
    ]);
  }

  /**
   * Flip's `absolute: true` takes the cover out of flow for the length of the
   * morph. The cover is the only thing giving its grid row height, so the row
   * collapses to zero and every block below it jumps ~730px up the page — the
   * flicker, and why the next image lands on top of the cover. Pinning the
   * row's measured height for the duration holds the page still.
   */
  private lockCoverRow() {
    const cell = this.preview?.parentElement;
    if (!cell) return;

    /* Pinning the container height alone stopped being enough once the cover
       gained siblings — the video and the below-image share this grid. Taking
       the cover out of grid flow re-places them a row earlier, so they jump up
       into the space it just left. Freezing the used row tracks holds them:
       `getComputedStyle` hands these back already resolved to pixels. */
    cell.style.gridTemplateRows = getComputedStyle(cell).gridTemplateRows;
    cell.style.height = `${cell.getBoundingClientRect().height}px`;
  }

  private unlockCoverRow() {
    const cell = this.preview?.parentElement;
    if (!cell) return;
    cell.style.gridTemplateRows = "";
    cell.style.height = "";
  }

  /**
   * Everything that should clear with the overlay: not the title, which holds
   * still through the whole transition, and not the cover, which is the thing
   * morphing. Without this the case study stays on screen for the entire close.
   */
  /**
   * How far the title has to travel to sit where the work page's label sits.
   * The label is pinned at viewport centre, the title rests at the top of the
   * hero, so this is the gap between the two — applied as a `from` on open and
   * a `to` on close, both in lockstep with the cover morph.
   */
  private titleOffset(title: HTMLElement) {
    const box = title.getBoundingClientRect();
    return window.innerHeight / 2 - (box.top + box.height / 2);
  }

  private activeTitle() {
    const group = this.groups.find((g) => g.classList.contains("active"));
    return group?.querySelector<HTMLElement>(".project__title") ?? null;
  }

  private contentParts() {
    const group = this.groups.find((g) => g.classList.contains("active"));
    if (!group) return [];

    /* The cover's own siblings are in here too: they sit in the cover's grid,
       so without this they were at full opacity the instant `.content`
       displayed — you saw the second image first, then the cover flew in over
       the top of it. Not `.project__cover-media` itself, which is the thing
       morphing. */
    return gsap.utils.toArray<HTMLElement>(
      ".project__services, .project__body, .project__block, .project__cover-video, .project__cover-below",
      group,
    );
  }

  parts() {
    const slide = this.activeSlide!;

    /* Queried live, not cached in the constructor: WheelView appends its ring
       clones after Transition is built, and a clone left behind sits over the
       project at full opacity for the whole morph. */
    const all = gsap.utils.toArray<HTMLElement>(".gallery__slide", this.root);

    return {
      wrapper: slide.querySelector(".gallery__img-wrapper") as HTMLElement,
      others: all.filter((s) => s !== slide),
    };
  }

  /**
   * Others ordered by screen distance from the tile being opened. The ring and
   * the column differ only in where the tiles happen to be, so distance is the
   * whole of what makes the exit ripple outward in either.
   *
   * Uniform scale about `center center` leaves a tile's centre where it was,
   * so the close reproduces the same order off the shrunken tiles.
   */
  private byDistanceFrom(slide: HTMLElement, others: HTMLElement[]) {
    const mid = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const from = mid(slide);

    // Decorate/sort/undecorate — one rect read per tile rather than one per
    // comparison.
    return others
      .map((el) => {
        const m = mid(el);
        return { el, d: Math.hypot(m.x - from.x, m.y - from.y) };
      })
      .sort((a, b) => a.d - b.d)
      .map((o) => o.el);
  }

  reset() {
    document.documentElement.classList.remove("work-project-open");
    document.documentElement.classList.remove("work-transitioning");
    document.documentElement.classList.remove("work-morphing");

    if (!this.activeSlide) {
      this.state = "closed";
      this.activeSlug = null;
      this.content.setAttribute("aria-hidden", "true");
      this.onClose?.();
      return;
    }

    const { wrapper, others } = this.parts();

    delete wrapper.dataset.flipId;

    /* The clear beat runs before `tl` exists, so a close during it lands here
       with nothing to reverse. Kill it first: it is still animating these
       tiles, and a bare `set` would be overwritten on the very next tick —
       leaving the gallery empty with nothing left to restore it.
       Scope the kill to the exit props — a bare killTweensOf takes the grid
       verticalLoop's yPercent children with it, and wheel/click die. */
    gsap.killTweensOf(others, "scale,opacity,visibility");
    gsap.set(others, { scale: 1, autoAlpha: 1 });

    /* Same reasoning for the overlay's own content: an interrupted close would
       otherwise leave the case study invisible the next time it opens. */
    this.unlockCoverRow();
    const parts = this.contentParts();
    gsap.killTweensOf(parts);
    gsap.set(parts, { clearProps: "opacity,visibility" });

    // Or the next open would measure its travel from a title already shifted.
    const title = this.activeTitle();
    if (title) {
      gsap.killTweensOf(title);
      gsap.set(title, { clearProps: "transform" });
    }

    this.splitBody?.revert();
    this.splitBody = null;

    gsap.set(this.content, { display: "none" });
    this.content.setAttribute("aria-hidden", "true");
    if (this.preview) gsap.set(this.preview, { clearProps: "all" });
    if (this.previewImg) gsap.set(this.previewImg, { clearProps: "all" });
    if (this.preview) delete this.preview.dataset.flipId;
    gsap.set(wrapper, { clearProps: "all" });

    this.activeSlide = null;
    this.activeSlug = null;
    this.preview = null;
    this.previewImg = null;
    this.tl = null;
    this.state = "closed";

    this.onClose?.();
  }
}
