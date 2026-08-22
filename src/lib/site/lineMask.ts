/**
 * Shared geometry for mask-clipped line reveals.
 *
 * Every line entrance on the site splits with SplitText's `mask: "lines"` and
 * slides the lines up from below their own mask. The park offset overshoots
 * 100% so descenders clear the mask edge instead of peeking below it — it was
 * spelled as a bare `110` in five files, which read as arbitrary.
 *
 * Durations, eases and staggers stay with each caller: the menu, hero, work
 * transition and generic body reveal are deliberately timed differently.
 */
import gsap from "gsap";

export const LINE_PARK_PERCENT = 110;

/** Hold split lines below their mask, ready to be released. */
export function parkLines(lines: gsap.TweenTarget): void {
  gsap.set(lines, { yPercent: LINE_PARK_PERCENT });
}
