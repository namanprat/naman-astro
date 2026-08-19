/**
 * Input semantics shared by both gallery engines, so `Slider` and `WheelView`
 * cannot drift apart on what a gesture means.
 */

/** What both engines need off an Observer, and all this module reads. */
type ObserverDelta = {
  deltaX: number;
  deltaY: number;
  event: Event;
};

/**
 * Scroll distance for one Observer event, in wheel-delta terms.
 *
 * Observer reports the two input types in opposite senses for the same intent. A
 * wheel's `deltaY` is positive scrolling *down*; a drag's is positive when the
 * finger travels *down*, which is the gesture for scrolling *up*. Both engines
 * were tuned against the wheel and fed touch through the same path unchanged, so
 * on a phone every swipe drove the gallery the wrong way.
 *
 * Negating the non-wheel case puts a swipe up and a wheel down on one sign —
 * what a native scroller does — and leaves wheel and trackpad exactly as they
 * were.
 *
 * Dominant axis wins, so a mostly-horizontal gesture still moves the gallery.
 */
export function scrollDelta({ deltaX, deltaY, event }: ObserverDelta): number {
  const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
  return event?.type === "wheel" ? delta : -delta;
}
