import { useEffect, useRef, useState, type CSSProperties } from "react";
import { gsap } from "gsap";
import Lenis from "lenis";
import { workItems } from "@/content/work";
import { ABOUT_OPEN_CLASS } from "@/lib/site/aboutPanel";
import { gooeyMorph } from "@/lib/site/gooeyReveal";
import { setSiteLenis } from "@/lib/site/lenisBridge";
import { SCROLL_SETTINGS, driveLenisWithGsap } from "@/lib/site/lenisScroll";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import {
  readWorkView,
  takeWorkReturn,
  writeWorkView,
  type WorkView,
} from "@/lib/site/workSession";
import ProjectDetail from "./ProjectDetail";
import Reveal from "./slider/Reveal";
import Slider, { isWorkGridMobile, WORK_GRID_MOBILE_MQ } from "./slider/Slider";
import WheelView from "./slider/WheelView";
import Transition, { type CloseReason } from "./slider/Transition";
import ViewSwitcher, { type ViewSwitcherItem } from "../ViewSwitcher";
import "./Work.css";

const WORK_VIEWS: readonly ViewSwitcherItem<WorkView>[] = [
  { id: "slider", label: "Slider" },
  { id: "grid", label: "Grid" },
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
    /* One controller for every listener this effect adds, so the cleanup cannot
       drift from the list. Six delegated handlers on `root` used to be added
       and never removed; a second run against the same node then left an
       orphaned engine whose Observer kept swallowing wheel and touch. */
    const listeners = new AbortController();
    const on = <T extends EventTarget>(
      target: T,
      type: string,
      handler: EventListenerOrEventListenerObject,
    ) => target.addEventListener(type, handler, { signal: listeners.signal });

    const onCloseRequest = () => {
      if (!transition || transition.state === "closed") return;
      void transition.close();
    };

    const onPopState = () => {
      if (!transition) return;
      if (transition.state !== "closed") {
        // The browser has already moved the URL; the close must reconcile in
        // place rather than push over the entry Back just landed on.
        void transition.close({ fromPopstate: true });
        return;
      }
      /* Back landed on a project entry with the gallery already showing —
         every close pushes a `/work` entry, so the project entry stays in the
         stack behind it. There is nothing to close, so the address is simply
         wrong for what is on screen, and left that way the nav's WORK link
         stops reading as an in-page close (`isInPageMenuNav` tests the
         pathname) and hard-reloads the page, replaying the whole reverse Flip
         for what should have been a no-op. Correct it in place. */
      if (window.location.pathname !== "/work") {
        history.replaceState({ workProject: null }, "", "/work");
      }
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

    /* `about-open` rather than `.about-panel.is-open`: that class carries the
       panel's visibility and pointer-events, so it has to outlive the exit
       animation and is removed from an `onReverseComplete`. An exit that never
       completed would have muted the gallery for good. */
    const engineEnabled = () =>
      transition?.state === "closed" &&
      !switchingRef.current &&
      !document.documentElement.classList.contains("menu-open") &&
      !document.documentElement.classList.contains(ABOUT_OPEN_CLASS);

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

      /* Runs on every exit, cancelled or not. `swap()` installs the new engine
         stopped, so bailing here without it left the gallery with a disabled
         Observer and `switchingRef` stuck true — wheel and touch were then
         dropped by `engineEnabled()` with nothing on screen to explain it. */
      const done = () => {
        switchingRef.current = false;
        engineRef.current?.suspendResize(false);
        if (cancelled) return;
        engineRef.current?.start();
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
            overlayLenis?.scrollTo(0, { immediate: true, force: true });
          },
          onClose: ({ fromPopstate }: CloseReason) => {
            if (cancelled) return;
            overlayLenis?.stop();
            setSiteLenis(null);
            /* The gallery is what is on screen, so the address has to say
               `/work` either way. After a popstate that is a correction to the
               entry the browser just landed on — `replaceState`, or a push
               would immediately undo the Back that got us here. Skipping the
               sync entirely, as this used to, is what left `/work` showing a
               `/work/[slug]` URL, and from there the nav's WORK link stopped
               reading as an in-page close and hard-reloaded the page. */
            if (window.location.pathname !== "/work") {
              const entry = { workProject: null };
              if (fromPopstate) history.replaceState(entry, "", "/work");
              else history.pushState(entry, "", "/work");
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
               morph, so anything Lenis read before this is zero.

               `start()` comes before the rewind: Lenis drops a `scrollTo` while
               it is stopped unless `force` is passed, so rewinding first was a
               silent no-op and the overlay could open already scrolled.
               `scrollToSection.ts` passes `force` for the same reason. */
            overlayLenis?.resize();
            overlayLenis?.start();
            overlayLenis?.scrollTo(0, { immediate: true, force: true });
            // Menu and pageTransition stop/start whatever is in this slot.
            if (overlayLenis) setSiteLenis(overlayLenis);
          },
        });

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

        on(root, "click", (e) => {
          const tile = tileOfEvent(e);
          if (tile) openTile(tile);
        });

        on(root, "keydown", (e) => {
          const event = e as KeyboardEvent;
          if (event.key !== "Enter" && event.key !== " ") return;
          const tile = tileOfEvent(event);
          if (!tile) return;
          event.preventDefault();
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

        on(root, "mouseover", (e) => {
          const tile = tileOfEvent(e);
          if (tile) nameTile(tile);
        });
        on(root, "mouseout", clearName);

        on(root, "focusin", (e) => {
          const tile = tileOfEvent(e);
          if (tile) nameTile(tile);
        });
        on(root, "focusout", clearName);

        on(window, "work:close", onCloseRequest);
        on(window, "popstate", onPopState);

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
          // Nothing to fly home to. The engine is already stopped, and only a
          // completed close restarts it, so hand it back here or the gallery
          // arrives permanently unscrollable.
          engineRef.current.start();
          endReturn();
          return;
        }
        await transition.snapOpen(returnSlide, returnIndex);

        if (cancelled) return;
        endReturn();
        // `snapOpen` bails without opening if it was superseded or the project
        // has no preview to morph; `close()` then has nothing to reverse and
        // returns early, leaving the stop above in place.
        if (transition.state === "closed") engineRef.current.start();
        else void transition.close();
      } catch (err) {
        console.error("Work gallery failed to boot", err);
        /* The clear beat fades the *slides*, not their wrappers — restoring
           wrappers left the six tiles at `autoAlpha: 0, scale: 0.6` and the
           Works view came back empty. */
        gsap.set(root.querySelectorAll(".gallery__slide"), {
          autoAlpha: 1,
          scale: 1,
        });
        gsap.set(root.querySelectorAll(".gallery__img-wrapper"), {
          autoAlpha: 1,
        });
        engineRef.current?.start();
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
    mobileMq.addEventListener("change", onMobileMq, {
      signal: listeners.signal,
    });

    return () => {
      cancelled = true;
      document.documentElement.classList.remove("page-work");
      document.documentElement.classList.remove("work-project-open");
      document.documentElement.classList.remove("work-morphing");
      endReturn();
      listeners.abort();
      engineRef.current?.destroy();
      engineRef.current = null;
      // Not `tl.kill()`: that skipped `reset()` and left the morph's `flipId`,
      // the pinned cover row, a live SplitText and `html.work-transitioning`
      // (`cursor: progress` on everything) behind.
      transition?.destroy();
      transition = null;
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
