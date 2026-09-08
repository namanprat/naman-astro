/**
 * FAQ accordion: open/close heights and the on-scroll entrance.
 *
 * ponytail: no state of its own. Which panels are open lives in the DOM, on
 * each button's `aria-expanded` — the attribute the screen reader already
 * needs, so keeping a second copy in a `Set` (as the React version did) only
 * created something that could disagree with it.
 */
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/site/util/prefersReducedMotion";

gsap.registerPlugin(ScrollTrigger);

const OPEN_S = 0.5;
const CLOSE_S = 0.4;

function toggle(button: HTMLButtonElement, panel: HTMLElement) {
  const isOpen = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!isOpen));

  /* Animate to `auto` rather than a measured scrollHeight, so a resize or a
     late font swap can't leave a panel clipped. Every settled toggle refreshes
     ScrollTrigger: opening one changes `.studio`'s height, and the footer's
     scale scrub measures `.studio`'s bottom. */
  const height = isOpen ? 0 : "auto";

  if (prefersReducedMotion()) {
    gsap.set(panel, { height });
    ScrollTrigger.refresh();
    return;
  }

  gsap.to(panel, {
    height,
    duration: isOpen ? CLOSE_S : OPEN_S,
    ease: "power2.out",
    overwrite: true,
    onComplete: () => ScrollTrigger.refresh(),
  });
}

export function bootFaq() {
  const root = document.querySelector<HTMLElement>(".faq_wrap");
  if (!root) return;

  for (const button of root.querySelectorAll<HTMLButtonElement>(".faq_question")) {
    const panel = document.getElementById(
      button.getAttribute("aria-controls") ?? "",
    );
    if (!panel) continue;
    button.addEventListener("click", () => toggle(button, panel));
  }

  if (prefersReducedMotion()) return;

  const items = gsap.utils.toArray<HTMLElement>(".faq_item", root);
  if (!items.length) return;

  gsap.from(items, {
    opacity: 0,
    y: 20,
    duration: 0.6,
    ease: "power2.out",
    stagger: 0.1,
    /* Not tidying: `y` leaves an identity `transform` on every item, and a
       transform is a stacking context, which isolates the group from the page
       backdrop. `.faq_question_text` and `.faq_answer_copy` blend `difference`
       against the fluid trail (`FluidCanvas.css`), so the leftover matrix left
       both reading their flat colour while the liquid passed straight under
       them. */
    clearProps: "transform,opacity",
    scrollTrigger: { trigger: root, start: "top 75%", once: true },
  });
}
