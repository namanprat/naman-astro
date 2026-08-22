/**
 * GreenSock Rolling text hover — SplitText chars duplicate into a vertical
 * stack; hover rolls the stack up with a short stagger.
 * https://codepen.io/GreenSock/pen/dPMjJWv
 */

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { prefersReducedMotion } from "./prefersReducedMotion";

gsap.registerPlugin(SplitText);

type RollingTextDispose = () => void;

function resolveHost(el: HTMLElement): HTMLElement {
  return (
    el.closest<HTMLElement>("a, button") ??
    el.closest<HTMLElement>(".anime_link") ??
    el
  );
}

export function initRollingText(el: HTMLElement): RollingTextDispose {
  if (prefersReducedMotion()) {
    return () => {};
  }

  const split = SplitText.create(el, {
    type: "chars",
    charsClass: "roll_char",
    aria: "auto",
  });

  const inners: HTMLElement[] = [];

  for (const char of split.chars as HTMLElement[]) {
    const html = char.innerHTML;
    if (!html || html === " ") continue;

    const inner = document.createElement("span");
    inner.className = "roll_char_inner";
    inner.setAttribute("aria-hidden", "true");

    const a = document.createElement("span");
    a.className = "roll_char_glyph";
    a.innerHTML = html;

    const b = document.createElement("span");
    b.className = "roll_char_glyph";
    b.innerHTML = html;

    inner.append(a, b);
    char.replaceChildren(inner);

    /* The mask is clamped to one glyph in CSS via `height: 1em`, not measured
       here. A measured pixel height is only correct for the font-size that was
       live at init — these styles are fluid, so after a resize (or a webfont
       swap) the lock stayed stale and clipped the glyph. 1em re-resolves on its
       own, and the roll is percentage-based so it needs no pixel value. */
    inners.push(inner);
  }

  if (!inners.length) {
    split.revert();
    return () => {};
  }

  // Inner is two glyphs tall; -50% rolls exactly one glyph into view.
  const tl = gsap.timeline({ paused: true });
  tl.to(inners, {
    yPercent: -50,
    duration: 0.45,
    ease: "power3.inOut",
    stagger: { each: 0.02 },
  });

  const host = resolveHost(el);

  const onEnter = () => {
    tl.play();
  };
  const onLeave = () => {
    tl.reverse();
  };

  host.addEventListener("mouseenter", onEnter);
  host.addEventListener("mouseleave", onLeave);
  host.addEventListener("focus", onEnter);
  host.addEventListener("blur", onLeave);

  return () => {
    host.removeEventListener("mouseenter", onEnter);
    host.removeEventListener("mouseleave", onLeave);
    host.removeEventListener("focus", onEnter);
    host.removeEventListener("blur", onLeave);
    tl.kill();
    split.revert();
  };
}
