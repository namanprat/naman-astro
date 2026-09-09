/**
 * Mount a WebGL stage when its box comes near, and park it when it leaves.
 *
 * This is `ProcessCardStage.tsx` and `FooterAsciiStage.tsx` with the React
 * taken out — they were never really components, only two `useEffect`s and a
 * boolean each. Both exist because the 3D stack is expensive twice over: once
 * as bytes on the boot path, and again as a live GPU context competing with the
 * backdrop for as long as it is up.
 *
 * ponytail: `near` latches and never un-latches, so scrolling past disposes
 * nothing. Tearing a context down and rebuilding it on every scroll-past costs
 * far more than leaving the stage parked, which is what `visible` is for.
 * `wide` is *not* latched — narrowing past the mobile breakpoint really should
 * dispose the footer field, because phones show a plain masked wordmark there
 * and a context kept alive behind it buys nothing.
 */

export type GateState = {
  /** Media query currently satisfied. Not latched. */
  wide: boolean;
  /** Has ever come within `rootMargin`. Latched. */
  near: boolean;
  /** Currently intersecting — drives park/resume, not mount. */
  visible: boolean;
};

export type GateEvent =
  | { type: "media"; wide: boolean }
  | { type: "intersect"; intersecting: boolean };

export const INITIAL_GATE: GateState = {
  wide: true,
  near: false,
  visible: false,
};

export function nextGateState(state: GateState, event: GateEvent): GateState {
  if (event.type === "media") return { ...state, wide: event.wide };
  return {
    ...state,
    near: state.near || event.intersecting,
    visible: event.intersecting,
  };
}

/** Whether the stage should exist at all, as opposed to be running. */
export function shouldMount(state: GateState): boolean {
  return state.wide && state.near;
}

export type LazyStageHandle = { dispose(): void };

export type MountWhenNearOptions = {
  /** Grow the observer box, as R3F-era `rootMargin: "20% 0px"`. */
  rootMargin?: string;
  /**
   * Only mount while this matches. Stated positively, so a desktop-only
   * surface passes `"(width >= 48rem)"` rather than `MOBILE_LAYOUT_MQ` — the
   * React gate held the negation internally (`wide = !mq.matches`), which read
   * backwards at every call site.
   */
  media?: string;
  /** Called when visibility changes while mounted — park or resume here. */
  onVisible?: (visible: boolean, handle: LazyStageHandle) => void;
};

/**
 * Boots `create` once `host` comes near (and `media` matches, if given).
 * Returns a teardown for the caller's own lifecycle.
 */
export function mountWhenNear(
  host: HTMLElement,
  create: () => Promise<LazyStageHandle>,
  options: MountWhenNearOptions = {},
): () => void {
  const { rootMargin = "20% 0px", media, onVisible } = options;

  let state: GateState = { ...INITIAL_GATE, wide: !media };
  let handle: LazyStageHandle | null = null;
  /** Set while `create()` is in flight, so a resize mid-boot still disposes. */
  let booting = false;
  let torn = false;

  const sync = () => {
    if (torn) return;
    const wanted = shouldMount(state);
    if (wanted && !handle && !booting) {
      booting = true;
      void create().then(
        (next) => {
          booting = false;
          // The gate may have closed, or the caller torn down, while the
          // renderer was initialising — `createCanvasStage` awaits a GPU device.
          if (torn || !shouldMount(state)) {
            next.dispose();
            return;
          }
          handle = next;
          onVisible?.(state.visible, next);
        },
        () => {
          booting = false;
        },
      );
    } else if (!wanted && handle) {
      handle.dispose();
      handle = null;
    } else if (handle) {
      onVisible?.(state.visible, handle);
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      state = nextGateState(state, {
        type: "intersect",
        intersecting: entry.isIntersecting,
      });
      sync();
    },
    { rootMargin, threshold: 0 },
  );
  observer.observe(host);

  let mq: MediaQueryList | null = null;
  const onMedia = () => {
    state = nextGateState(state, { type: "media", wide: !!mq?.matches });
    sync();
  };
  if (media) {
    mq = window.matchMedia(media);
    mq.addEventListener("change", onMedia);
    onMedia();
  }

  return () => {
    if (torn) return;
    torn = true;
    observer.disconnect();
    mq?.removeEventListener("change", onMedia);
    handle?.dispose();
    handle = null;
  };
}
