import { expect, test } from "@playwright/test";
import { scrollDelta } from "../src/components/work/slider/scrollInput";

/**
 * The sign contract both `/work` engines are built on.
 *
 * Observer hands wheel and touch deltas over in opposite senses for the same
 * user intent: a wheel's `deltaY` is positive scrolling *down*, a drag's is
 * positive when the finger travels *down* — which is the gesture for scrolling
 * *up*. Both engines were tuned against the wheel and fed touch through the same
 * path unchanged, so on a phone every swipe drove the gallery backwards.
 *
 * Asserted here rather than through the browser because it is a pure function
 * and the invariant is exact: one gesture intent, one sign. The device-matrix
 * specs cover the same ground end to end, but only to the resolution of "did the
 * gallery move".
 */
const asEvent = (type: string) => ({ type }) as Event;

const wheel = (deltaY: number, deltaX = 0) =>
  scrollDelta({ deltaX, deltaY, event: asEvent("wheel") });

const drag = (deltaY: number, deltaX = 0) =>
  scrollDelta({ deltaX, deltaY, event: asEvent("touchmove") });

test.describe("scrollDelta", () => {
  test("a wheel delta passes through untouched", () => {
    expect(wheel(700)).toBe(700);
    expect(wheel(-700)).toBe(-700);
  });

  test("scrolling down is one sign whichever device asks for it", () => {
    // Wheel down and a finger travelling up are the same request.
    expect(Math.sign(wheel(700))).toBe(Math.sign(drag(-700)));
    expect(Math.sign(wheel(-700))).toBe(Math.sign(drag(700)));
  });

  test("the dominant axis wins, so a sideways swipe still drives the gallery", () => {
    expect(drag(10, -700)).toBe(700);
    expect(wheel(10, 700)).toBe(700);
  });

  test("a pointermove drag is treated as touch, not as a wheel", () => {
    const move = scrollDelta({
      deltaX: 0,
      deltaY: 700,
      event: asEvent("pointermove"),
    });
    expect(Math.sign(move)).toBe(Math.sign(drag(700)));
  });
});
