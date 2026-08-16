import { gsap } from "gsap";

type VerticalLoopConfig = {
  repeat?: number;
  paused?: boolean;
  speed?: number;
  snap?: number | false;
  paddingBottom?: number;
};

/** Animate items along the y-axis in a loop */
export default function verticalLoop(
  items: gsap.DOMTarget,
  config: VerticalLoopConfig = {},
) {
  const elements = gsap.utils.toArray<HTMLElement>(items);

  const tl = gsap.timeline({
    repeat: config.repeat,
    paused: config.paused,
    defaults: { ease: "none" },
    onReverseComplete: () => {
      tl.totalTime(tl.rawTime() + tl.duration() * 100);
    },
  });

  const length = elements.length;
  const startY = 0;
  const heights: number[] = [];
  const yPercents: number[] = [];
  const pixelsPerSecond = (config.speed || 1) * 100;
  const snap =
    config.snap === false ? (v: number) => v : gsap.utils.snap(config.snap || 1);

  gsap.set(elements, {
    yPercent: (i, el) => {
      const h = (heights[i] = parseFloat(
        gsap.getProperty(el, "height", "px") as string,
      ));
      yPercents[i] = snap(
        (parseFloat(gsap.getProperty(el, "y", "px") as string) / h) * 100 +
          (gsap.getProperty(el, "yPercent") as number),
      );
      return yPercents[i];
    },
  });
  gsap.set(elements, { y: 0 });

  const totalHeight =
    elements[length - 1].offsetTop +
    (yPercents[length - 1] / 100) * heights[length - 1] -
    startY +
    elements[length - 1].offsetHeight *
      (gsap.getProperty(elements[length - 1], "scaleY") as number) +
    (parseFloat(String(config.paddingBottom)) || 0);

  for (let i = 0; i < length; i++) {
    const item = elements[i];
    const curY = (yPercents[i] / 100) * heights[i];
    const distanceToStart = item.offsetTop + curY - startY;
    const distanceToLoop =
      distanceToStart +
      heights[i] * (gsap.getProperty(item, "scaleY") as number);

    tl.to(
      item,
      {
        yPercent: snap(((curY - distanceToLoop) / heights[i]) * 100),
        duration: distanceToLoop / pixelsPerSecond,
      },
      0,
    ).fromTo(
      item,
      {
        yPercent: snap(
          ((curY - distanceToLoop + totalHeight) / heights[i]) * 100,
        ),
      },
      {
        yPercent: yPercents[i],
        duration: (totalHeight - distanceToLoop) / pixelsPerSecond,
        immediateRender: false,
      },
      distanceToLoop / pixelsPerSecond,
    );
  }

  tl.progress(1, true).progress(0, true);

  return tl;
}
