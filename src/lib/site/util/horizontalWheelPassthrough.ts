/**
 * Hand sideways trackpad swipes back to the browser.
 *
 * `/work` and `/archive` both swallow every wheel event they see — the two
 * gallery engines run `Observer.create({ type: "wheel,touch", preventDefault:
 * true })` on `window`, and the orb's rig calls `preventDefault()` on its own
 * canvas listener. `Observer`'s `preventDefault` is all-or-nothing, so a
 * two-finger swipe left was consumed as slider input and the browser never got
 * its back/forward gesture.
 *
 * This is a capture-phase listener on `window`, which is the first thing to see
 * any wheel event. For a horizontal-dominant one it calls
 * `stopImmediatePropagation`, so no site handler runs at all, nothing calls
 * `preventDefault`, and the browser performs the navigation. Vertical wheels
 * are untouched and reach the engines exactly as before.
 *
 * `overscroll-behavior-x` must also stay `auto` on the route, or the browser
 * disables the gesture regardless — see `Work.css` and `Archive.css`.
 *
 * Registration order does not matter, which is the reason for the capture
 * phase rather than merely being first: the capture pass over `window` runs
 * before the event reaches any descendant (the orb's canvas) and before
 * `window`'s own bubble-phase listeners (both `Observer`s), whenever each of
 * them was attached.
 */

/** How much wider than tall a gesture must be before it counts as sideways. */
const DOMINANCE = 1.5;

/**
 * Quiet gap that ends a gesture.
 *
 * A trackpad fling arrives as a stream whose head and tail are diagonal. Once
 * a stream is judged horizontal the verdict is held for the rest of it, so the
 * end of a swipe cannot leak a few events into the slider (and vice versa).
 */
const GESTURE_GAP_MS = 150;

let installed = false;

export function horizontalWheelPassthrough(): () => void {
  if (typeof window === "undefined") return () => {};
  // Idempotent: both routes call this, and a hard nav can re-run the boot.
  if (installed) return () => {};
  installed = true;

  let lastEventAt = 0;
  let gestureIsHorizontal: boolean | null = null;

  const onWheel = (e: WheelEvent) => {
    const now = e.timeStamp;
    if (now - lastEventAt > GESTURE_GAP_MS) gestureIsHorizontal = null;
    lastEventAt = now;

    if (gestureIsHorizontal === null) {
      gestureIsHorizontal =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) * DOMINANCE;
    }

    if (gestureIsHorizontal) e.stopImmediatePropagation();
  };

  window.addEventListener("wheel", onWheel, { capture: true, passive: true });
  return () => {
    window.removeEventListener("wheel", onWheel, { capture: true });
    installed = false;
  };
}
