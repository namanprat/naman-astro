/**
 * Featured carousel: clip-path hops + gooey titles.
 * Pre-rendered layers; pendingIndex queues nav while a hop runs.
 */
import gsap from "gsap";
import CustomEase from "gsap/CustomEase";
import { gooeyMorph } from "./gooeyReveal";
import { go } from "./navigate";
import { prefersReducedMotion } from "./prefersReducedMotion";

gsap.registerPlugin(CustomEase);
if (!CustomEase.get("camilleHop")) {
  CustomEase.create(
    "camilleHop",
    "M0,0 C0.071,0.505 0.192,0.726 0.318,0.852 0.45,0.984 0.504,1 1,1",
  );
}

const AUTOPLAY_MS = 5000;

export type CamilleSliderHandle = { destroy: () => void };

function kickerLabel(raw: string): string {
  const trimmed = raw.trim();
  return trimmed ? `[ ${trimmed} ]` : "";
}

function padIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function initCamilleSlider(root: HTMLElement): CamilleSliderHandle {
  const stage = root.querySelector<HTMLElement>(".camille_slider_stage");
  const frame = root.querySelector<HTMLElement>(".camille_slider_frame");
  const images = root.querySelector<HTMLElement>(".camille_slider_images");
  const prevBtn = root.querySelector<HTMLElement>(".camille_slider_prev");
  const nextBtn = root.querySelector<HTMLElement>(".camille_slider_next");
  const indexEl = root.querySelector<HTMLElement>(".camille_slider_index");
  const titleInner = root.querySelector<HTMLElement>(
    ".camille_slider_title_inner",
  );
  const kickerInner = root.querySelector<HTMLElement>(
    ".camille_slider_kicker_inner",
  );
  const viewLink = root.querySelector<HTMLAnchorElement>(
    ".camille_slider_view",
  );
  const pills = [
    ...root.querySelectorAll<HTMLButtonElement>(".camille_slider_pill"),
  ];
  const layers = [
    ...root.querySelectorAll<HTMLElement>(
      ".camille_slider_images .camille_slider_img",
    ),
  ];

  if (!stage || !frame || !images || !layers.length) {
    return { destroy: () => {} };
  }

  const titles = layers.map(
    (layer) =>
      layer.dataset.slideTitle ?? layer.querySelector("img")?.alt ?? "",
  );
  const kickers = layers.map((layer) =>
    kickerLabel(layer.dataset.slideKicker ?? ""),
  );
  const hrefs = layers.map((layer) => layer.dataset.slideHref ?? "/work");
  const total = layers.length;

  let current = 0;
  let busy = false;
  let pendingIndex: number | null = null;
  let morphTl: gsap.core.Timeline | null = null;
  let kickerTl: gsap.core.Timeline | null = null;
  let autoplayTimer = 0;

  const reduced = prefersReducedMotion();

  const wrap = (index: number) => ((index % total) + total) % total;

  const stopAutoplay = () => {
    window.clearInterval(autoplayTimer);
    autoplayTimer = 0;
  };

  /** Also the "restart the countdown" call after a manual nav. */
  const startAutoplay = () => {
    stopAutoplay();
    if (reduced) return;
    autoplayTimer = window.setInterval(() => {
      goTo(current + 1);
    }, AUTOPLAY_MS);
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

  const syncChrome = () => {
    if (indexEl) indexEl.textContent = padIndex(current);
    if (viewLink) viewLink.href = hrefs[current] ?? "/work";
    pills.forEach((pill, i) => {
      const on = i === current;
      pill.classList.toggle("is-active", on);
      pill.setAttribute("aria-selected", on ? "true" : "false");
    });

    const nextTitle = titles[current] ?? "";
    const nextKicker = kickers[current] ?? "";
    const instant = reduced;

    if (titleInner && titleInner.textContent !== nextTitle) {
      morphTl?.kill();
      if (instant) titleInner.textContent = nextTitle;
      else {
        morphTl = gooeyMorph(titleInner, () => {
          titleInner.textContent = nextTitle;
        });
      }
    }

    if (kickerInner && kickerInner.textContent !== nextKicker) {
      kickerTl?.kill();
      if (instant) kickerInner.textContent = nextKicker;
      else {
        kickerTl = gooeyMorph(kickerInner, () => {
          kickerInner.textContent = nextKicker;
        });
      }
    }
  };

  const finishHop = () => {
    busy = false;
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

    if (reduced) {
      showOnly(to);
      return;
    }

    busy = true;

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
    const next = wrap(index);
    if (next === current) return;
    if (busy) {
      pendingIndex = next;
      return;
    }
    const from = current;
    let dir: "left" | "right";
    if (from === 0 && next === total - 1) dir = "left";
    else if (from === total - 1 && next === 0) dir = "right";
    else dir = next < from ? "left" : "right";
    current = next;
    hop(from, next, dir);
    syncChrome();
    startAutoplay();
  };

  const onPrev = (e: MouseEvent) => {
    e.stopPropagation();
    goTo(current - 1);
  };
  const onNext = (e: MouseEvent) => {
    e.stopPropagation();
    goTo(current + 1);
  };
  const onView = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const href = viewLink?.href;
    if (href) void go(href);
  };
  const onPill = (e: MouseEvent) => {
    const pill = e.currentTarget;
    if (!(pill instanceof HTMLElement)) return;
    const index = Number(pill.dataset.slideIndex);
    if (!Number.isFinite(index)) return;
    goTo(index);
  };

  prevBtn?.addEventListener("click", onPrev);
  nextBtn?.addEventListener("click", onNext);
  viewLink?.addEventListener("click", onView);
  for (const pill of pills) pill.addEventListener("click", onPill);

  startAutoplay();

  return {
    destroy: () => {
      morphTl?.kill();
      kickerTl?.kill();
      stopAutoplay();
      prevBtn?.removeEventListener("click", onPrev);
      nextBtn?.removeEventListener("click", onNext);
      viewLink?.removeEventListener("click", onView);
      for (const pill of pills) pill.removeEventListener("click", onPill);
      gsap.killTweensOf(
        images.querySelectorAll(".camille_slider_photo, .camille_slider_img"),
      );
    },
  };
}
