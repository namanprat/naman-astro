/**
 * Featured carousel: clip-path hops + gooey titles.
 * Pre-rendered layers; pendingIndex queues nav while a hop runs.
 *
 * Title and kicker are owned gooey targets — same park / arm / settle /
 * addGooeyReveal / gooeyMorph path as every other heading. The inners are
 * hand-built (Footer-style) rather than SplitText, because a hop swaps
 * `textContent` and a second split would fight that.
 */
import gsap from "gsap";
import CustomEase from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  addGooeyReveal,
  armGooey,
  gooeyMorph,
  parkGooey,
  REVEAL_START,
  settleGooey,
  type GooeyTarget,
} from "./gooeyReveal";
import { go } from "./navigate";
import { prefersReducedMotion } from "./prefersReducedMotion";

gsap.registerPlugin(CustomEase, ScrollTrigger);
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
  const titleEl = root.querySelector<HTMLElement>(".camille_slider_title");
  const titleInner = root.querySelector<HTMLElement>(
    ".camille_slider_title_inner",
  );
  const kickerEl = root.querySelector<HTMLElement>(".camille_slider_kicker");
  const kickerInner = root.querySelector<HTMLElement>(
    ".camille_slider_kicker_inner",
  );
  const hitLink = root.querySelector<HTMLAnchorElement>(".camille_slider_hit");
  const cursorEl = root.querySelector<HTMLElement>(".camille_slider_cursor");
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
  let revealTl: gsap.core.Timeline | null = null;
  let revealSt: ScrollTrigger | null = null;
  let autoplayTimer = 0;

  const reduced = prefersReducedMotion();

  /* Hand-built: the inner already sits in markup, same as Footer links.
     `prepareGooey` would SplitText the heading and then a hop's textContent
     swap would leave the split pointing at the old string. */
  const titleTarget: GooeyTarget | null =
    !reduced && titleEl && titleInner
      ? { el: titleEl, inners: [titleInner] }
      : null;
  const kickerTarget: GooeyTarget | null =
    !reduced && kickerEl && kickerInner
      ? { el: kickerEl, inners: [kickerInner] }
      : null;
  const gooeyTargets = [titleTarget, kickerTarget].filter(
    (t): t is GooeyTarget => t !== null,
  );

  if (gooeyTargets.length) {
    parkGooey(gooeyTargets);
    revealSt = ScrollTrigger.create({
      trigger: titleEl ?? root,
      start: REVEAL_START,
      once: true,
      onEnter: () => {
        revealTl = gsap.timeline();
        addGooeyReveal(revealTl, gooeyTargets);
      },
    });
  }

  const cancelEntrance = () => {
    const inFlight = revealTl?.isActive() ?? false;
    const notYetEntered = !!revealSt && !revealTl;
    revealTl?.kill();
    revealTl = null;
    revealSt?.kill();
    revealSt = null;
    if ((inFlight || notYetEntered) && gooeyTargets.length) {
      settleGooey(gooeyTargets);
    }
  };

  const wrap = (index: number) => ((index % total) + total) % total;

  const chromeSel =
    ".camille_slider_prev, .camille_slider_next, .camille_slider_rail, .camille_slider_copy, .camille_slider_pills, .camille_slider_hit";

  const overChrome = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest(chromeSel);

  const hideViewCursor = () => {
    frame.classList.remove("is-view-cursor");
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !cursorEl) {
      hideViewCursor();
      return;
    }
    if (overChrome(event.target)) {
      hideViewCursor();
      return;
    }
    frame.classList.add("is-view-cursor");
    cursorEl.style.left = `${event.clientX}px`;
    cursorEl.style.top = `${event.clientY}px`;
  };

  const onPointerLeave = () => {
    hideViewCursor();
  };

  const openCurrent = () => {
    const href = hrefs[current];
    if (href) void go(href);
  };

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
    if (hitLink) hitLink.href = hrefs[current] ?? "/work";
    pills.forEach((pill, i) => {
      const on = i === current;
      pill.classList.toggle("is-active", on);
      pill.setAttribute("aria-selected", on ? "true" : "false");
    });

    const nextTitle = titles[current] ?? "";
    const nextKicker = kickers[current] ?? "";
    const instant = reduced;
    const titleChanged = !!titleInner && titleInner.textContent !== nextTitle;
    const kickerChanged =
      !!kickerInner && kickerInner.textContent !== nextKicker;

    if (titleChanged || kickerChanged) cancelEntrance();

    if (titleChanged && titleInner) {
      morphTl?.kill();
      if (instant) titleInner.textContent = nextTitle;
      else {
        if (titleTarget) armGooey(titleTarget);
        morphTl = gooeyMorph(titleInner, () => {
          titleInner.textContent = nextTitle;
        });
      }
    }

    if (kickerChanged && kickerInner) {
      kickerTl?.kill();
      if (instant) kickerInner.textContent = nextKicker;
      else {
        if (kickerTarget) armGooey(kickerTarget);
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
  const onHit = (e: MouseEvent) => {
    e.preventDefault();
    openCurrent();
  };
  const onFrameClick = (e: MouseEvent) => {
    if (overChrome(e.target)) return;
    openCurrent();
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
  hitLink?.addEventListener("click", onHit);
  frame.addEventListener("click", onFrameClick);
  frame.addEventListener("pointermove", onPointerMove);
  frame.addEventListener("pointerleave", onPointerLeave);
  for (const pill of pills) pill.addEventListener("click", onPill);

  startAutoplay();

  return {
    destroy: () => {
      morphTl?.kill();
      kickerTl?.kill();
      cancelEntrance();
      stopAutoplay();
      prevBtn?.removeEventListener("click", onPrev);
      nextBtn?.removeEventListener("click", onNext);
      hitLink?.removeEventListener("click", onHit);
      frame.removeEventListener("click", onFrameClick);
      frame.removeEventListener("pointermove", onPointerMove);
      frame.removeEventListener("pointerleave", onPointerLeave);
      hideViewCursor();
      for (const pill of pills) pill.removeEventListener("click", onPill);
      gsap.killTweensOf(
        images.querySelectorAll(".camille_slider_photo, .camille_slider_img"),
      );
    },
  };
}
