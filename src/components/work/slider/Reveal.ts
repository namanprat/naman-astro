import { gsap } from "gsap";

export type RevealChange = {
  el: HTMLElement;
  visible: boolean;
  top: number;
};

type RevealItem = {
  wrapper: HTMLElement;
};

/** Reveal each slide image as it enters the viewport */
export default class Reveal {
  items = new Map<HTMLElement, RevealItem>();

  constructor(root: ParentNode = document) {
    gsap.utils.toArray<HTMLElement>(".gallery__slide", root).forEach((slide) => {
      const wrapper = slide.querySelector<HTMLElement>(".gallery__img-wrapper");
      if (!wrapper) return;

      gsap.set(wrapper, { autoAlpha: 0 });

      this.items.set(slide, { wrapper });
    });
  }

  toggle(changes: RevealChange[], immediate = false) {
    changes
      .filter((change) => change.visible)
      .sort((a, b) => a.top - b.top)
      .forEach((change, i) => this.show(change.el, i * 0.12, immediate));

    changes
      .filter((change) => !change.visible)
      .forEach((change) => this.hide(change.el));
  }

  show(slide: HTMLElement, delay: number, immediate = false) {
    const item = this.items.get(slide);
    if (!item) return;
    const { wrapper } = item;

    if (immediate) {
      gsap.set(wrapper, { autoAlpha: 1, overwrite: true });
      return;
    }

    gsap.to(wrapper, {
      autoAlpha: 1,
      duration: 1,
      ease: "power2.out",
      delay,
      overwrite: true,
    });
  }

  hide(slide: HTMLElement) {
    const item = this.items.get(slide);
    if (!item) return;

    gsap.set(item.wrapper, { autoAlpha: 0, overwrite: true });
  }
}
