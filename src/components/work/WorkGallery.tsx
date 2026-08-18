import { useEffect, useRef, useState, type CSSProperties } from "react";
import { gsap } from "gsap";
import Lenis from "lenis";
import { workItems } from "../../content/work";
import { gooeyMorph } from "../../lib/site/gooeyReveal";
import { setSiteLenis } from "../../lib/site/lenisBridge";
import {
  SCROLL_SETTINGS,
  driveLenisWithGsap,
} from "../../lib/site/lenisScroll";
import { prefersReducedMotion } from "../../lib/site/prefersReducedMotion";
import { takeWorkReturn } from "../../lib/site/workReturn";
import {
  readWorkView,
  writeWorkView,
  type WorkView,
} from "../../lib/site/workView";
import ProjectDetail from "./ProjectDetail";
import Reveal from "./slider/Reveal";
import Slider, { isWorkGridMobile, WORK_GRID_MOBILE_MQ } from "./slider/Slider";
import WheelView from "./slider/WheelView";
import Transition from "./slider/Transition";
import ViewSwitcher from "../ViewSwitcher";
import "./Work.css";

const WORK_VIEWS = [
  { id: "slider" as const, label: "Slider" },
  { id: "grid" as const, label: "Grid" },
];

/** Settled hover before a morph fires, so sweeping across tiles doesn't melt
 *  the label once per tile the cursor crosses. */
const MORPH_DELAY_MS = 80;

/** Fade each way when swapping slider ↔ grid. Title gooey runs in parallel. */
const DISSOLVE_S = 0.35;

/**
 * What `WorkGallery` needs from whichever view is driving the tiles. `Slider`
 * (vertical grid) and `WheelView` (the circular ring) both satisfy it, so the
 * return path and the open flow work against either without branching.
 */
type ViewEngine = {
  start(): void;
  stop(): void;
  centerOn(index: number): void;
  neutralise(): void;
  suspendResize(suspended: boolean): void;
  destroy(): void;
  readonly centeredIndex: number;
};

export default function WorkGallery() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  /* Two states, because the text has to change at the blur peak rather than
     when the pointer moves: `hoverTitle` is the input the slide handlers set,
     `shownTitle` is what the label actually renders. */
  const [hoverTitle, setHoverTitle] = useState<string | null>(null);
  const [shownTitle, setShownTitle] = useState<string | null>(null);
  const labelInnerRef = useRef<HTMLSpanElement>(null);
  const morphTlRef = useRef<gsap.core.Timeline | null>(null);
  /* A ref, not `shownTitle`, so this effect can depend on `hoverTitle` alone.
     Depending on both would re-run it when the swap lands mid-morph, and the
     cleanup would kill the timeline before it blurred back down. */
  const shownRef = useRef<string | null>(null);

  const [view, setView] = useState<WorkView>(readWorkView);
  const [switching, setSwitching] = useState(false);
  const viewRef = useRef<WorkView>(view);
  const switchingRef = useRef(false);
  const engineRef = useRef<ViewEngine | null>(null);
  const transitionRef = useRef<Transition | null>(null);
  const switchViewRef = useRef<(next: WorkView) => void>(() => {});

  useEffect(() => {
    if (hoverTitle === shownRef.current) return;
    const inner = labelInnerRef.current;
    if (!inner) return;

    const timer = window.setTimeout(() => {
      // Retarget rather than queue: a new name starts from wherever the last
      // morph got to, so the label never lags behind the cursor.
      morphTlRef.current?.kill();
      morphTlRef.current = gooeyMorph(inner, () => {
        shownRef.current = hoverTitle;
        setShownTitle(hoverTitle);
      });
    }, MORPH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [hoverTitle]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    document.documentElement.classList.add("page-work");

    /* Consumed synchronously on every /work mount, not just the returning
       one — an inline script in work.astro has already hidden the gallery
       from this flag, so a boot that never reads it would strand that. */
    const returnSlug = takeWorkReturn();
    const returnIndex = returnSlug
      ? workItems.findIndex((item) => item.slug === returnSlug)
      : -1;

    const endReturn = () =>
      document.documentElement.classList.remove("work-returning");

    let transition: Transition | null = null;
    let overlayLenis: Lenis | null = null;
    let stopDrivingLenis: (() => void) | null = null;
    let cancelled = false;
    /* Set while a popstate is what triggered the close, so reset() doesn't
       push a second entry on top of the one the browser just popped. */
    let closingFromPopstate = false;

    const onCloseRequest = () => {
      if (!transition || transition.state === "closed") return;
      void transition.close();
    };

    const onPopState = () => {
      if (!transition || transition.state === "closed") return;
      closingFromPopstate = true;
      void transition.close();
    };

    /* The gallery is only ever `<img>`, so `complete` plus load/error events are
       the whole of what imagesLoaded gave us. Deliberately NOT `decode()`: a
       decode stays pending indefinitely while the tab is hidden, so /work opened
       in a background tab would never boot and the gallery would stay hidden.
       Load events fire either way, and "settled" — not "succeeded" — is the
       signal boot wants, so error resolves too. */
    const pending = [...root.querySelectorAll("img")].filter(
      (img) => !img.complete,
    );
    const imgsSettled = () =>
      Promise.all(
        pending.map(
          (img) =>
            new Promise<void>((resolve) => {
              const done = () => resolve();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
            }),
        ),
      );

    const slideEls = () => [
      ...root.querySelectorAll<HTMLElement>(".gallery__slide"),
    ];

    const engineEnabled = () =>
      transition!.state === "closed" &&
      !switchingRef.current &&
      !document.documentElement.classList.contains("menu-open") &&
      !document.querySelector(".about-panel.is-open");

    /**
     * Build the engine for `next`. Grid keeps Reveal driving per-tile fades;
     * the wheel does not use it at all — six tiles on one ring, all of them
     * always placed, so the bookkeeping would cost more than it saves.
     */
    const makeEngine = (next: WorkView): ViewEngine => {
      if (next === "grid") {
        // Reveal's constructor parks every wrapper at autoAlpha 0; the engine's
        // first applyParallax then shows whatever is on screen. Re-making it per
        // switch is what stops tiles stranding at the visibility the other view
        // left them on.
        const reveal = new Reveal(root);
        return new Slider({
          root,
          enabled: engineEnabled,
          onToggle: (changes, immediate) => reveal.toggle(changes, immediate),
          onCenterChange: (index) => {
            if (viewRef.current !== "grid") return;
            if (switchingRef.current) return;
            if (!isWorkGridMobile()) return;
            setHoverTitle(workItems[index]?.title ?? null);
          },
        });
      }

      gsap.set(root.querySelectorAll(".gallery__img-wrapper"), {
        autoAlpha: 1,
      });
      return new WheelView({
        root,
        enabled: engineEnabled,
        onCenterChange: (index) => {
          if (viewRef.current !== "slider") return;
          setHoverTitle(workItems[index]?.title ?? null);
        },
      });
    };

    /** Dissolve the tiles, swap layout, dissolve in. Title gooey is the hover
     *  morph already wired to `hoverTitle`. */
    const switchView = (next: WorkView) => {
      const engine = engineRef.current;
      if (!engine || switchingRef.current) return;
      if (next === viewRef.current) return;
      if (!transition || transition.state !== "closed") return;

      switchingRef.current = true;
      setSwitching(true);

      const centered = engine.centeredIndex;
      const gallery = root.querySelector<HTMLElement>(".gallery");

      if (next === "grid") {
        setHoverTitle(
          isWorkGridMobile() ? (workItems[centered]?.title ?? null) : null,
        );
      } else {
        setHoverTitle(workItems[centered]?.title ?? null);
      }

      engine.suspendResize(true);
      engine.stop();

      const swap = () => {
        engine.neutralise();
        engine.destroy();

        viewRef.current = next;
        setView(next);
        writeWorkView(next);
        root.dataset.workView = next;

        /* Several authors share each slide's transform — CSS translateX
           (absorbed into GSAP's cached x), the loop's yPercent, the parallax y,
           and the ring's placement. Clear them or the cached values fight the new
           layout. Same reason Slider.rebuild() does this before re-measuring. */
        gsap.set(slideEls(), { clearProps: "transform,zIndex" });
        gsap.set(root.querySelectorAll(".gallery__img"), {
          clearProps: "transform",
        });

        const built = makeEngine(next);
        built.centerOn(centered);
        built.stop();
        engineRef.current = built;
      };

      const done = () => {
        if (cancelled) return;
        engineRef.current?.start();
        switchingRef.current = false;
        setSwitching(false);
      };

      if (!gallery || prefersReducedMotion()) {
        swap();
        if (gallery) gsap.set(gallery, { autoAlpha: 1 });
        done();
        return;
      }

      gsap.to(gallery, {
        autoAlpha: 0,
        duration: DISSOLVE_S,
        ease: "power2.inOut",
        onComplete: () => {
          if (cancelled) return;
          swap();
          gsap.fromTo(
            gallery,
            { autoAlpha: 0 },
            {
              autoAlpha: 1,
              duration: DISSOLVE_S,
              ease: "power2.inOut",
              onComplete: done,
            },
          );
        },
      });
    };

    switchViewRef.current = switchView;

    const boot = async () => {
      if (cancelled || !rootRef.current) return;

      setReady(true);

      try {
        /* The overlay is its own scroll container — `html.page-work` is
           `overflow: hidden`, so there is no document scroller for a `root`
           Lenis to take. Same settings as the homepage and the hard project
           page, so all three scroll identically. */
        const wrap = root.querySelector<HTMLElement>(".content-wrapper");
        const groupList = root.querySelector<HTMLElement>(
          ".content__group-list",
        );

        if (wrap && groupList) {
          overlayLenis = new Lenis({
            ...SCROLL_SETTINGS,
            wrapper: wrap,
            content: groupList,
          });
          stopDrivingLenis = driveLenisWithGsap(overlayLenis);
          // Nothing to scroll until a project opens, and `.content` is
          // `display: none` until then, so it would measure zero anyway.
          overlayLenis.stop();
        }

        transition = new Transition({
          root,
          // Rewind the overlay to the cover before the box travels home, so
          // Flip measures the cover rather than a scrolled-away frame.
          onBeforeClose: async () => {
            overlayLenis?.scrollTo(0, { immediate: true });
          },
          onClose: () => {
            if (cancelled) return;
            overlayLenis?.stop();
            setSiteLenis(null);
            if (closingFromPopstate) {
              closingFromPopstate = false;
            } else if (window.location.pathname !== "/work") {
              history.pushState({ workProject: null }, "", "/work");
            }
            engineRef.current?.start();
            if (viewRef.current === "grid" && isWorkGridMobile()) {
              const centered = engineRef.current?.centeredIndex ?? -1;
              setHoverTitle(workItems[centered]?.title ?? null);
            }
          },
          onOpenComplete: (slug) => {
            // The overlay *is* the project view — no document swap, just the URL.
            if (window.location.pathname !== `/work/${slug}`) {
              history.pushState({ workProject: slug }, "", `/work/${slug}`);
            }
            /* Measured only now: the wrapper was `display: none` for the whole
               morph, so anything Lenis read before this is zero. */
            overlayLenis?.resize();
            overlayLenis?.scrollTo(0, { immediate: true });
            overlayLenis?.start();
            // Menu and pageTransition stop/start whatever is in this slot.
            if (overlayLenis) setSiteLenis(overlayLenis);
          },
        });
        transitionRef.current = transition;

        engineRef.current = makeEngine(viewRef.current);
        if (viewRef.current === "grid" && isWorkGridMobile()) {
          const centered = engineRef.current.centeredIndex;
          setHoverTitle(workItems[centered]?.title ?? null);
        }

        const slides = slideEls();

        /* Click is delegated, not per-slide: the wheel appends cloned tiles to
           fill the ring, and a clone carries no listeners of its own. Hover
           stays per-slide — only the grid uses it, and the grid has no clones. */

        /* The tile you clicked is the one that morphs — clone or original, and
           wherever it sits on the ring. That is why the wheel no longer turns
           an off-anchor pick to the top first: the spin only existed to make
           the original the Flip source. */
        const openTile = (slide: HTMLElement) => {
          const index = Number(slide.dataset.index ?? -1);
          if (index < 0) return;
          if (!transition || transition.state !== "closed") return;
          if (switchingRef.current) return;

          if (viewRef.current === "grid") setHoverTitle(null);
          engineRef.current?.stop();
          void transition.open(slide, index);
        };

        const tileOfEvent = (e: Event) =>
          e.target instanceof Element
            ? e.target.closest<HTMLElement>(".gallery__slide")
            : null;

        root.addEventListener("click", (e) => {
          const tile = tileOfEvent(e);
          if (tile) openTile(tile);
        });

        root.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          const tile = tileOfEvent(e);
          if (!tile) return;
          e.preventDefault();
          openTile(tile);
        });

        /* Hover is delegated too, and for the same reason clicks are: half the
           ring is clones, which carry no listeners of their own. `mouseenter`
           and `focus` don't bubble, so this uses their bubbling counterparts.
           No same-tile guard needed — `.gallery__img-wrapper` is
           `pointer-events: none`, so the figure is the only hit target inside
           a tile and moving within one never re-fires. */
        const nameTile = (tile: HTMLElement) => {
          if (!transition || transition.state !== "closed") return;
          setHoverTitle(tile.dataset.title || null);
        };

        /* Leaving a tile: the ring always names something — fall back to
           whichever project sits at the anchor. The phone grid does the same
           for the tile crossing the title; desktop grid names nothing. */
        const clearName = () => {
          const centered = engineRef.current?.centeredIndex ?? -1;
          const fromCenter =
            viewRef.current === "slider" ||
            (viewRef.current === "grid" && isWorkGridMobile());
          setHoverTitle(
            fromCenter ? (workItems[centered]?.title ?? null) : null,
          );
        };

        root.addEventListener("mouseover", (e) => {
          const tile = tileOfEvent(e);
          if (tile) nameTile(tile);
        });
        root.addEventListener("mouseout", clearName);

        root.addEventListener("focusin", (e) => {
          const tile = tileOfEvent(e);
          if (tile) nameTile(tile);
        });
        root.addEventListener("focusout", clearName);

        window.addEventListener("work:close", onCloseRequest);
        window.addEventListener("popstate", onPopState);

        if (returnIndex < 0) {
          endReturn();
          return;
        }

        // Arrived from a hard-loaded project page: centre the slide the image
        // has to fly home to (otherwise it lands off-screen), take up the open
        // state without animating, then play the normal close in reverse.
        // Engine-agnostic — both views expose centerOn.
        engineRef.current.stop();
        engineRef.current.centerOn(returnIndex);
        const returnSlide = slides[returnIndex];
        if (!returnSlide) {
          endReturn();
          return;
        }
        await transition.snapOpen(returnSlide, returnIndex);

        if (cancelled) return;
        endReturn();
        void transition.close();
      } catch (err) {
        console.error("Work gallery failed to boot", err);
        gsap.set(root.querySelectorAll(".gallery__img-wrapper"), {
          autoAlpha: 1,
        });
        endReturn();
      }
    };

    const scheduleBoot = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) void boot();
        });
      });
    };

    /* The returning path must not sit behind image decode: the gallery is
       hidden until the reverse starts, and its box sizes come from CSS
       (span token + aspect-ratio), so centreOn can measure before any
       thumbnail has decoded. The project's own image is already cached.
       Two frames so imported CSS has laid out slide sizes before measure. */
    if (!pending.length || returnIndex >= 0) scheduleBoot();
    else void imgsSettled().then(scheduleBoot);

    const mobileMq = window.matchMedia(WORK_GRID_MOBILE_MQ);
    const onMobileMq = () => {
      if (viewRef.current !== "grid") return;
      if (mobileMq.matches) {
        const centered = engineRef.current?.centeredIndex ?? -1;
        setHoverTitle(workItems[centered]?.title ?? null);
      } else {
        setHoverTitle(null);
      }
    };
    mobileMq.addEventListener("change", onMobileMq);

    return () => {
      cancelled = true;
      document.documentElement.classList.remove("page-work");
      document.documentElement.classList.remove("work-project-open");
      document.documentElement.classList.remove("work-morphing");
      endReturn();
      mobileMq.removeEventListener("change", onMobileMq);
      window.removeEventListener("work:close", onCloseRequest);
      window.removeEventListener("popstate", onPopState);
      engineRef.current?.destroy();
      transition?.tl?.kill();
      morphTlRef.current?.kill();
      gsap.killTweensOf(root.querySelector(".gallery"));
      stopDrivingLenis?.();
      overlayLenis?.destroy();
      setSiteLenis(null);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`work-page${ready ? "" : " is-loading"}`}
      data-work-view={view}
    >
      {/* Permanently armed, unlike the one-shot heading entrance: the label
          morphs repeatedly and at blur 0 the threshold is a near no-op, so
          `.gooey-reveal` is static here rather than being toggled by
          park/settle. The inner carries the filter chain, same as everywhere
          else — keeping it off the `<p>` also keeps the filter away from a
          `position: fixed` + `transform` box, which WebKit handles badly. */}
      <p
        className="gallery-label gooey-reveal text-style-display"
        aria-live="polite"
      >
        <span ref={labelInnerRef} className="gooey-reveal__inner">
          {shownTitle ? (
            shownTitle
          ) : (
            <>
              Works
              <span className="gallery-label__count">({workItems.length})</span>
            </>
          )}
        </span>
      </p>

      <div className="gallery container" aria-label="Selected work">
        {workItems.map((item, index) => (
          <figure
            key={item.slug}
            className="gallery__slide"
            data-slug={item.slug}
            data-title={item.title}
            data-href={`/work/${item.slug}`}
            data-span={item.span}
            data-index={index}
            tabIndex={0}
            role="link"
            aria-label={`View ${item.title}`}
            style={
              {
                "--slide-span": item.span,
                "--slide-col": item.col,
              } as CSSProperties
            }
          >
            <div className="gallery__img-wrapper">
              <img
                className="gallery__img"
                src={item.image}
                alt={item.alt}
                loading="eager"
                draggable={false}
              />
            </div>
          </figure>
        ))}
      </div>

      <ViewSwitcher
        label="Work view"
        views={WORK_VIEWS}
        view={view}
        busy={switching || !ready}
        onSelect={(next) => switchViewRef.current(next)}
      />

      <div className="content" aria-hidden="true">
        <div className="content-wrapper">
          <div className="content__group-list">
            {workItems.map((item, index) => (
              <ProjectDetail
                key={item.slug}
                item={item}
                variant="overlay"
                index={index}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
