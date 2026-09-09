/**
 * Work gallery controller. Markup is `WorkGallery.astro`.
 */
import { gsap } from "gsap";
import Lenis from "lenis";
import { ABOUT_OPEN_CLASS } from "@/lib/site/about/aboutPanel";
import { gooeyMorph } from "@/lib/site/reveal/gooeyReveal";
import { setSiteLenis } from "@/lib/site/scroll/lenisBridge";
import { SCROLL_SETTINGS, driveLenisWithGsap } from "@/lib/site/scroll/lenisScroll";
import { prefersReducedMotion } from "@/lib/site/util/prefersReducedMotion";
import {
  readWorkView,
  takeWorkReturn,
  writeWorkView,
  type WorkView,
} from "@/lib/site/nav/workSession";
import { isMobileLayout, MOBILE_LAYOUT_MQ } from "@/lib/site/util/isMobileLayout";
import { bootLazyVideos } from "@/lib/site/util/lazyVideo";
import Reveal from "./slider/Reveal";
import Slider from "./slider/Slider";
import WheelView from "./slider/WheelView";
import Transition, { type CloseReason } from "./slider/Transition";

/** Settled hover before a morph fires, so sweeping across tiles doesn't melt
 *  the label once per tile the cursor crosses. */
const MORPH_DELAY_MS = 80;

/** Fade each way when swapping slider ↔ grid. Title gooey runs in parallel. */
const DISSOLVE_S = 0.35;

function initialWorkView(): WorkView {
  return isMobileLayout() ? "slider" : readWorkView();
}

type ViewEngine = {
  start(): void;
  stop(): void;
  centerOn(index: number): void;
  neutralise(): void;
  suspendResize(suspended: boolean): void;
  destroy(): void;
  readonly centeredIndex: number;
};

export function bootWorkGallery(): void {
  const root = document.querySelector<HTMLElement>(".work_wrap");
  if (!root) return;

  const labelInner = root.querySelector<HTMLElement>(
    ".gallery_label .gooey_reveal_inner",
  );
  const switcher = root.querySelector<HTMLElement>("[data-view-switcher]");
  const slides = () => [...root.querySelectorAll<HTMLElement>(".gallery_slide")];
  const slideTitle = (index: number) => slides()[index]?.dataset.title ?? null;

  let hoverTitle: string | null = null;
  let shownTitle: string | null = null;
  let morphTimer = 0;
  let morphTl: gsap.core.Timeline | null = null;
  let view: WorkView = initialWorkView();
  let switching = false;
  let ready = false;
  let engine: ViewEngine | null = null;

  const paintSwitcher = () => {
    if (!switcher) return;
    switcher.dataset.view = view;
    switcher.toggleAttribute("data-busy", switching || !ready);
    for (const tab of switcher.querySelectorAll<HTMLButtonElement>(
      "[data-view-id]",
    )) {
      tab.setAttribute("aria-pressed", String(tab.dataset.viewId === view));
      tab.disabled = switching || !ready;
    }
  };

  const applyView = (next: WorkView) => {
    view = next;
    root.dataset.workView = next;
    document.documentElement.classList.toggle("work-grid", next === "grid");
    paintSwitcher();
  };

  const writeLabel = (title: string | null) => {
    if (!labelInner) return;
    shownTitle = title;
    if (title) {
      labelInner.textContent = title;
      return;
    }
    const count = slides().length;
    const countEl = document.createElement("span");
    countEl.className = "gallery_label_count";
    countEl.textContent = `(${count})`;
    labelInner.replaceChildren(document.createTextNode("Works"), countEl);
  };

  const setHoverTitle = (title: string | null) => {
    hoverTitle = title;
    if (hoverTitle === shownTitle) return;
    if (!labelInner) return;
    window.clearTimeout(morphTimer);
    morphTimer = window.setTimeout(() => {
      morphTl?.kill();
      morphTl = gooeyMorph(labelInner, () => writeLabel(hoverTitle));
    }, MORPH_DELAY_MS);
  };

  applyView(view);

  document.documentElement.classList.add("page-work");

  const stopLazyVideos = bootLazyVideos(root);

  const returnSlug = takeWorkReturn();
  const returnIndex = returnSlug
    ? slides().findIndex((slide) => slide.dataset.slug === returnSlug)
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

  /* Gallery thumbs only. `.content` holds every project's case-study markup
     for the Flip overlay, including `loading="lazy"` panels inside a
     `display: none` scroller. Those images are not in the layout, so they
     never fire load/error — waiting on `img` at the root stranded boot on
     `is-loading` and left the ring unplaced, which is why clicks did nothing.
     Deliberately NOT `decode()`: a decode stays pending indefinitely while
     the tab is hidden. Load events fire either way, and "settled" — not
     "succeeded" — is the signal boot wants, so error resolves too. */
  const pending = [
    ...root.querySelectorAll<HTMLImageElement>(".gallery_slide img"),
  ].filter((img) => !img.complete);
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

  const engineEnabled = () =>
    transition?.state === "closed" &&
    !switching &&
    !document.documentElement.classList.contains("menu-open") &&
    !document.documentElement.classList.contains(ABOUT_OPEN_CLASS);

  const makeEngine = (next: WorkView): ViewEngine => {
    if (next === "grid") {
      const reveal = new Reveal(root);
      return new Slider({
        root,
        enabled: engineEnabled,
        onToggle: (changes, immediate) => reveal.toggle(changes, immediate),
        onCenterChange: (index) => {
          if (view !== "grid") return;
          if (switching) return;
          if (!isMobileLayout()) return;
          setHoverTitle(slideTitle(index));
        },
      });
    }

    gsap.set(root.querySelectorAll(".gallery_img_wrap"), {
      autoAlpha: 1,
    });
    return new WheelView({
      root,
      enabled: engineEnabled,
      onCenterChange: (index) => {
        if (view !== "slider") return;
        setHoverTitle(slideTitle(index));
      },
    });
  };

  const switchView = (next: WorkView, persist = true) => {
    if (!engine || switching) return;
    if (next === view) return;
    if (!transition || transition.state !== "closed") return;

    switching = true;
    paintSwitcher();

    const centered = engine.centeredIndex;
    const gallery = root.querySelector<HTMLElement>(".gallery");

    if (next === "grid") {
      morphTl?.kill();
      shownTitle = null;
      setHoverTitle(null);
      writeLabel(null);
    } else {
      setHoverTitle(slideTitle(centered));
    }

    engine.suspendResize(true);
    engine.stop();

    const swap = () => {
      engine?.neutralise();
      engine?.destroy();

      applyView(next);
      if (persist && !isMobileLayout()) writeWorkView(next);

      gsap.set(slides(), { clearProps: "transform,zIndex" });
      gsap.set(root.querySelectorAll(".gallery_img"), {
        clearProps: "transform",
      });
      // Flush the new view's boxes before Slider/WheelView measure.
      void root.offsetHeight;

      const built = makeEngine(next);
      built.centerOn(centered);
      built.stop();
      engine = built;
    };

    const done = () => {
      switching = false;
      engine?.suspendResize(false);
      if (cancelled) return;
      engine?.start();
      paintSwitcher();
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

  const boot = async () => {
    if (cancelled || !root.isConnected) return;

    ready = true;
    root.classList.remove("is-loading");
    paintSwitcher();

    try {
      /* The overlay is its own scroll container — `html.page-work` is
         `overflow: hidden`, so there is no document scroller for a `root`
         Lenis to take. Same settings as the homepage and the hard project
         page, so all three scroll identically. */
      const wrap = root.querySelector<HTMLElement>(".content_wrap");
      const groupList = root.querySelector<HTMLElement>(
        ".content_group_list",
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
          engine?.start();
          if (view === "grid" && isMobileLayout()) {
            setHoverTitle(slideTitle(engine?.centeredIndex ?? -1));
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

      engine = makeEngine(view);
      if (view === "grid" && isMobileLayout()) {
        setHoverTitle(slideTitle(engine.centeredIndex));
      }

      const openTile = (slide: HTMLElement) => {
        const index = Number(slide.dataset.index ?? -1);
        if (index < 0) return;
        if (!transition || transition.state !== "closed") return;
        if (switching) return;

        if (view === "grid") setHoverTitle(null);
        if (view === "slider") {
          root
            .querySelectorAll(".gallery_slide.is-centered")
            .forEach((el) => el.classList.remove("is-centered"));
          slide.classList.add("is-centered");
        }
        engine?.stop();
        void transition.open(slide, index);
      };

      const tileOfEvent = (event: Event) =>
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(".gallery_slide")
          : null;

      on(root, "click", (event) => {
        const tile = tileOfEvent(event);
        if (tile) openTile(tile);
      });

      on(root, "keydown", (event) => {
        const keyEvent = event as KeyboardEvent;
        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
        const tile = tileOfEvent(keyEvent);
        if (!tile) return;
        keyEvent.preventDefault();
        openTile(tile);
      });

      const nameTile = (tile: HTMLElement) => {
        if (!transition || transition.state !== "closed") return;
        setHoverTitle(tile.dataset.title || null);
      };

      /* Leaving a tile: the ring always names something — fall back to
         whichever project sits at the anchor. The phone grid does the same
         for the tile crossing the title; desktop grid names nothing. */
      const clearName = () => {
        const fromCenter = view === "slider" || isMobileLayout();
        setHoverTitle(fromCenter ? slideTitle(engine?.centeredIndex ?? -1) : null);
      };

      on(root, "mouseover", (event) => {
        const tile = tileOfEvent(event);
        if (tile) nameTile(tile);
      });
      on(root, "mouseout", () => clearName());

      on(root, "focusin", (event) => {
        const tile = tileOfEvent(event);
        if (tile) nameTile(tile);
      });
      on(root, "focusout", () => clearName());

      on(window, "work:close", onCloseRequest);
      on(window, "popstate", onPopState);

      if (returnIndex < 0) {
        engine.start();
        endReturn();
        return;
      }

      // Arrived from a hard-loaded project page: centre the slide the image
      // has to fly home to (otherwise it lands off-screen), take up the open
      // state without animating, then play the normal close in reverse.
      engine.stop();
      engine.centerOn(returnIndex);
      const returnSlide = slides()[returnIndex];
      if (!returnSlide) {
        engine.start();
        endReturn();
        return;
      }
      await transition.snapOpen(returnSlide, returnIndex);

      if (cancelled) return;
      endReturn();
      if (transition.state === "closed") engine.start();
      else void transition.close();
    } catch (error) {
      console.error("Work gallery failed to boot", error);
      gsap.set(root.querySelectorAll(".gallery_slide"), {
        autoAlpha: 1,
        scale: 1,
      });
      gsap.set(root.querySelectorAll(".gallery_img_wrap"), {
        autoAlpha: 1,
      });
      engine?.start();
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

  if (switcher) {
    on(switcher, "click", (event) => {
      const tab = (event.target as Element | null)?.closest<HTMLButtonElement>(
        "[data-view-id]",
      );
      if (!tab || !switcher.contains(tab)) return;
      const next = tab.dataset.viewId;
      if (next === "slider" || next === "grid") switchView(next);
    });
  }

  const layoutMq = window.matchMedia(MOBILE_LAYOUT_MQ);
  const onLayoutChange = () => {
    if (layoutMq.matches) {
      if (view === "grid") switchView("slider", false);
      else setHoverTitle(slideTitle(engine?.centeredIndex ?? -1));
      return;
    }
    const stored = readWorkView();
    if (stored !== view) switchView(stored, false);
    else if (view === "grid") setHoverTitle(null);
  };
  layoutMq.addEventListener("change", onLayoutChange, {
    signal: listeners.signal,
  });

  const teardown = () => {
    if (cancelled) return;
    cancelled = true;
    listeners.abort();
    window.clearTimeout(morphTimer);
    morphTl?.kill();
    stopLazyVideos();
    document.documentElement.classList.remove("page-work");
    document.documentElement.classList.remove("work-grid");
    document.documentElement.classList.remove("work-project-open");
    document.documentElement.classList.remove("work-morphing");
    endReturn();
    engine?.destroy();
    engine = null;
    transition?.destroy();
    transition = null;
    gsap.killTweensOf(root.querySelector(".gallery"));
    stopDrivingLenis?.();
    overlayLenis?.destroy();
    overlayLenis = null;
    setSiteLenis(null);
  };

  window.addEventListener("pagehide", teardown, { once: true });
}
