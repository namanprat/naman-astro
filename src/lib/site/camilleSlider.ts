/**
 * Camille slider: clip-path hops + gooey titles + n-3 chrome.
 * Pre-rendered layers; pendingIndex queues nav while a hop runs.
 */
import gsap from "gsap";
import CustomEase from "gsap/CustomEase";
import { gooeyMorph } from "./gooeyReveal";
import { prefersReducedMotion } from "./prefersReducedMotion";

gsap.registerPlugin(CustomEase);
if (!CustomEase.get("camilleHop")) {
  CustomEase.create(
    "camilleHop",
    "M0,0 C0.071,0.505 0.192,0.726 0.318,0.852 0.45,0.984 0.504,1 1,1",
  );
}

export type CamilleSliderHandle = { destroy: () => void };

export function initCamilleSlider(root: HTMLElement): CamilleSliderHandle {
  const stage = root.querySelector<HTMLElement>(".camille_slider_stage");
  const frame = root.querySelector<HTMLElement>(".camille_slider_frame");
  const images = root.querySelector<HTMLElement>(".camille_slider_images");
  const chrome = root.querySelector<HTMLElement>(".camille_slider_chrome");
  const thumbsWrap = root.querySelector<HTMLElement>(".camille_slider_thumbs");
  const currentEl = root.querySelector<HTMLElement>(".camille_slider_current");
  const prevBtn = root.querySelector<HTMLElement>(".camille_slider_prev");
  const nextBtn = root.querySelector<HTMLElement>(".camille_slider_next");
  const titleInner = root.querySelector<HTMLElement>(
    ".camille_slider_title_inner",
  );
  const layers = [
    ...root.querySelectorAll<HTMLElement>(
      ".camille_slider_images .camille_slider_img",
    ),
  ];
  const thumbs = [
    ...root.querySelectorAll<HTMLElement>(
      ".camille_slider_thumbs .camille_slider_thumb",
    ),
  ];
  const lines = [...root.querySelectorAll<HTMLElement>(".camille_slider_line")];

  if (!stage || !frame || !images || !layers.length || !thumbs.length) {
    return { destroy: () => {} };
  }

  const titles = thumbs.map(
    (t) => t.dataset.slideTitle ?? t.getAttribute("aria-label") ?? "",
  );
  const total = layers.length;
  const nav = [prevBtn, nextBtn].filter(Boolean) as HTMLElement[];

  let current = 0;
  let busy = false;
  let pendingIndex: number | null = null;
  let morphTl: gsap.core.Timeline | null = null;

  const pad = (i: number) => String(i + 1).padStart(2, "0");

  const setNavDim = (on: boolean) => {
    for (const el of nav) el.style.opacity = on ? "0.3" : "";
  };

  const resetLayer = (layer: HTMLElement) => {
    layer.classList.remove("is-hopping", "is-incoming");
    gsap.killTweensOf(layer);
    const photo = layer.querySelector(".camille_slider_photo");
    if (photo) gsap.killTweensOf(photo);
    gsap.set(layer, { clearProps: "clipPath" });
    if (photo) gsap.set(photo, { clearProps: "x" });
  };

  const showOnly = (index: number) => {
    layers.forEach((layer, i) => {
      resetLayer(layer);
      layer.classList.toggle("is-active", i === index);
    });
  };

  const wave = (index: number | null) => {
    for (const line of lines) {
      line.style.removeProperty("--camille-line-h");
      line.style.removeProperty("--camille-line-opacity");
    }
    if (index === null || !thumbsWrap || !lines.length) return;

    const w = thumbsWrap.clientWidth;
    if (!w) return;
    const thumbW = w / total;
    const center = (index + 0.5) * thumbW;
    const lineW = w / lines.length;
    const reach = thumbW * 0.7;
    const base =
      parseFloat(
        getComputedStyle(stage).getPropertyValue("--camille-line-base"),
      ) || 0.75;
    const amp =
      parseFloat(
        getComputedStyle(stage).getPropertyValue("--camille-line-wave"),
      ) || 1.75;

    lines.forEach((line, i) => {
      const d = Math.abs((i + 0.5) * lineW - center);
      if (d > reach) return;
      const n = d / reach;
      const h = Math.cos((n * Math.PI) / 2);
      line.style.setProperty("--camille-line-h", `${base + h * amp}rem`);
      line.style.setProperty("--camille-line-opacity", String(0.3 + h * 0.4));
    });
  };

  const sync = () => {
    if (currentEl) currentEl.textContent = pad(current);
    thumbs.forEach((t, i) => {
      const on = i === current;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    wave(current);

    const next = titles[current] ?? "";
    if (!titleInner || titleInner.textContent === next) return;
    morphTl?.kill();
    if (prefersReducedMotion()) {
      titleInner.textContent = next;
      return;
    }
    morphTl = gooeyMorph(titleInner, () => {
      titleInner.textContent = next;
    });
  };

  const finishHop = () => {
    busy = false;
    setNavDim(false);
    showOnly(current);
    if (pendingIndex !== null && pendingIndex !== current) {
      const next = pendingIndex;
      pendingIndex = null;
      goTo(next);
    } else {
      pendingIndex = null;
    }
  };

  const hop = (from: number, to: number, dir: "left" | "right") => {
    const outLayer = layers[from];
    const inLayer = layers[to];
    if (!outLayer || !inLayer) return;

    if (prefersReducedMotion()) {
      showOnly(to);
      return;
    }

    busy = true;
    setNavDim(true);

    layers.forEach((layer) => {
      if (layer !== outLayer && layer !== inLayer) resetLayer(layer);
    });
    resetLayer(outLayer);
    resetLayer(inLayer);

    outLayer.classList.add("is-active", "is-hopping");
    inLayer.classList.add("is-hopping", "is-incoming");
    inLayer.classList.remove("is-active");

    const outPhoto = outLayer.querySelector<HTMLElement>(
      ".camille_slider_photo",
    );
    const inPhoto = inLayer.querySelector<HTMLElement>(".camille_slider_photo");

    if (inPhoto) gsap.set(inPhoto, { x: dir === "left" ? -500 : 500 });

    if (outPhoto) {
      gsap.to(outPhoto, {
        x: dir === "left" ? 500 : -500,
        duration: 1.5,
        ease: "camilleHop",
      });
    }

    gsap.fromTo(
      inLayer,
      {
        clipPath:
          dir === "left"
            ? "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)"
            : "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)",
      },
      {
        clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
        duration: 1.5,
        ease: "camilleHop",
      },
    );

    if (inPhoto) {
      gsap.to(inPhoto, {
        x: 0,
        duration: 1.5,
        ease: "camilleHop",
        onComplete: finishHop,
      });
    } else finishHop();
  };

  const goTo = (index: number) => {
    if (index < 0 || index >= total || index === current) return;
    if (busy) {
      pendingIndex = index;
      return;
    }
    const from = current;
    const dir = index < current ? "left" : "right";
    current = index;
    hop(from, index, dir);
    sync();
  };

  const onPrev = (e: MouseEvent) => {
    e.stopPropagation();
    goTo(current - 1);
  };
  const onNext = (e: MouseEvent) => {
    e.stopPropagation();
    goTo(current + 1);
  };
  prevBtn?.addEventListener("click", onPrev);
  nextBtn?.addEventListener("click", onNext);

  const onThumbsClick = (e: MouseEvent) => {
    const thumb = (e.target as Element | null)?.closest?.(
      ".camille_slider_thumb",
    ) as HTMLElement | null;
    if (!thumb || !thumbsWrap?.contains(thumb)) return;
    e.stopPropagation();
    const i = Number(thumb.dataset.slideIndex);
    if (Number.isFinite(i)) goTo(i);
  };
  const onThumbsOver = (e: MouseEvent) => {
    const thumb = (e.target as Element | null)?.closest?.(
      ".camille_slider_thumb",
    ) as HTMLElement | null;
    if (!thumb || !thumbsWrap?.contains(thumb)) return;
    wave(Number(thumb.dataset.slideIndex));
  };
  const onThumbsOut = () => wave(current);

  thumbsWrap?.addEventListener("click", onThumbsClick);
  thumbsWrap?.addEventListener("mouseover", onThumbsOver);
  thumbsWrap?.addEventListener("mouseleave", onThumbsOut);

  const onFrameClick = (e: MouseEvent) => {
    if (chrome && e.target instanceof Node && chrome.contains(e.target)) return;
    const { left, width } = frame.getBoundingClientRect();
    const mid = left + width / 2;
    if (e.clientX < mid) goTo(current - 1);
    else goTo(current + 1);
  };
  frame.addEventListener("click", onFrameClick);

  wave(0);

  return {
    destroy: () => {
      morphTl?.kill();
      prevBtn?.removeEventListener("click", onPrev);
      nextBtn?.removeEventListener("click", onNext);
      thumbsWrap?.removeEventListener("click", onThumbsClick);
      thumbsWrap?.removeEventListener("mouseover", onThumbsOver);
      thumbsWrap?.removeEventListener("mouseleave", onThumbsOut);
      frame.removeEventListener("click", onFrameClick);
      gsap.killTweensOf(
        images.querySelectorAll(".camille_slider_photo, .camille_slider_img"),
      );
    },
  };
}
