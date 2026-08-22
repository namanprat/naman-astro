import type { Observer } from "gsap/Observer";

/**
 * One scroll delta, in wheel space, from either input the gallery accepts.
 *
 * `Observer` reports its two sources on opposite sign conventions and never
 * reconciles them. A wheel contributes `event.deltaY` — scrolling *down* is
 * positive. A drag contributes `clientY - lastY` — a finger moving *down* is
 * positive. Both gestures mean "advance", and they mean it with opposite
 * signs, which is why the grid and the ring both tracked a wheel correctly on
 * desktop and ran backwards under every touch.
 *
 * Wheel space is what both engines are tuned for, so the drag is what flips.
 *
 * The symptom, in the words it was reported in: on a phone, scrolling down
 * scrolled the gallery up. Desktop was never wrong, which is the tell — the
 * wheel half of this was always in the right space.
 *
 * Shared rather than inlined twice: `Slider` and `WheelView` are independent
 * engines that happen to take the same input, and a sign convention kept in
 * two files is how this comes back on one of them.
 */
export function scrollDelta(self: Observer): number {
  const { deltaX, deltaY } = self;
  const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
  /* `self.event` is the raw event, set before `Observer` unwraps a touch, so
     the type is `wheel` / `touchmove` / `pointermove` rather than a `Touch`. */
  return self.event?.type === "wheel" ? delta : -delta;
}
