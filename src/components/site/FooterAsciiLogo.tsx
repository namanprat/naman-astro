import { useEffect, useRef, type RefObject } from "react";
import "./FooterAsciiLogo.css";

const CELL_SIZE = 7;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const FONT_SIZE = 11;
/**
 * Columns the card is scaled to fit. The authored 7/3/11 metrics assume a
 * desktop-width card; held fixed, a 390px phone card fits only ~35 columns
 * across the lockup, which reads as noise rather than as the wordmark.
 *
 * Chosen so a card of 960px or wider — every viewport at or above the 64rem
 * desktop breakpoint — divides to 10 or more and lands on the clamp, leaving
 * desktop rendering exactly as it was.
 */
const REFERENCE_COLS = 96;
/** Below roughly a 4px step the glyphs stop resolving at phone pixel ratios. */
const MIN_CELL_STEP = 4;
const ASCII_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const BRIGHTNESS_THRESHOLD = 0.5;
const HOVER_RADIUS = 10;
const HOVER_PUSH = 7;
const HOVER_EASE = 0.1;
const SCATTER_RANGE = 20;
const SCATTER_EASE = 0.075;
const GRAVITY = 0.05;
const BOUNCE = 0.25;
const RESET_EASE = 0.05;
const STAGGER_FRAMES = 18;
const DESKTOP_MQ = "(min-width: 64rem)";
const REDUCE_MQ = "(prefers-reduced-motion: reduce)";
const FINE_HOVER_MQ = "(hover: hover) and (pointer: fine)";
/** Fallback only — live ink is read off the wrapper's `color`. */
const CHAR_COLOR_FALLBACK = "#f14827";
const MONO_FONT =
  '"Duforn Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

type Phase = "logo" | "scattered" | "fallen" | "returning";

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "logo":
      return "SCATTER";
    case "scattered":
      return "DROP";
    case "fallen":
      return "RESET";
    case "returning":
      return "WAIT";
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

type Cell = {
  col: number;
  row: number;
  char: string;
  offsetX: number;
  offsetY: number;
  fallSpeed: number;
  wait: number;
  scatterX: number;
  scatterY: number;
};

function randomAsciiChar() {
  return ASCII_CHARS[Math.floor(Math.random() * ASCII_CHARS.length)];
}

function easeToward(
  cell: Cell,
  targetX: number,
  targetY: number,
  ease: number,
) {
  cell.offsetX += (targetX - cell.offsetX) * ease;
  cell.offsetY += (targetY - cell.offsetY) * ease;
}

type CellMetrics = { size: number; step: number; fontSize: number };

/** Grid metrics for a card of `width`, scaled off the authored desktop set. */
function metricsFor(width: number): CellMetrics {
  const step = Math.min(
    CELL_STEP,
    Math.max(MIN_CELL_STEP, Math.round(width / REFERENCE_COLS)),
  );
  const ratio = step / CELL_STEP;
  return {
    size: CELL_SIZE * ratio,
    step,
    fontSize: FONT_SIZE * ratio,
  };
}

function localScale(wrap: HTMLElement, wrapRect: DOMRect) {
  const w = Math.max(1, wrap.clientWidth);
  const h = Math.max(1, wrap.clientHeight);
  return {
    w,
    h,
    scaleX: wrapRect.width / w || 1,
    scaleY: wrapRect.height / h || 1,
  };
}

/**
 * Interactive ASCII wordmark — port of codegrid-interactive-ascii-footer-hover,
 * painted across the footer card and sampling the `.footer-logo` source SVG.
 */
export default function FooterAsciiLogo({
  sourceRef,
}: {
  sourceRef: RefObject<HTMLImageElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorLabelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const cursorEl = cursorRef.current;
    const cursorLabel = cursorLabelRef.current;
    const logoImg = sourceRef.current;
    if (!wrap || !canvas || !cursorEl || !cursorLabel || !logoImg) return;

    const box = wrap.parentElement;
    if (!box) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const desktopMq = window.matchMedia(DESKTOP_MQ);
    const reduceMq = window.matchMedia(REDUCE_MQ);
    const fineHoverMq = window.matchMedia(FINE_HOVER_MQ);
    /* Painting the wordmark and driving it from the pointer are separate
       concerns. The canvas is the footer lockup on every viewport; the push,
       the scatter and the custom cursor need a real pointer, so they stay on
       `cursorOn`. Folding the two together is what left mobile with no ASCII
       at all. */
    const enabled = () => !reduceMq.matches;
    const cursorOn = () =>
      enabled() && desktopMq.matches && fineHoverMq.matches;

    let phase: Phase = "logo";
    let metrics = metricsFor(Math.max(1, wrap.clientWidth));
    let gridCols = 0;
    let gridRows = 0;
    let cells: Cell[] = [];
    let raf = 0;
    let disposed = false;
    let running = false;
    let charColor = getComputedStyle(box).color || CHAR_COLOR_FALLBACK;
    const cursor = { col: -999, row: -999 };
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    const readCharColor = () => {
      charColor = getComputedStyle(box).color || CHAR_COLOR_FALLBACK;
    };

    const syncCursorLabel = () => {
      cursorLabel.textContent = phaseLabel(phase);
    };

    const setCursorVisible = (visible: boolean) => {
      cursorEl.classList.toggle("is-visible", visible);
    };

    const syncCursorMode = () => {
      box.classList.toggle("is-ascii-hover", cursorOn());
      if (!cursorOn()) setCursorVisible(false);
    };

    const setupCanvas = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      const ratio = dpr();
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const buildAsciiFromLogo = () => {
      if (!enabled()) {
        cells = [];
        ctx.clearRect(0, 0, wrap.clientWidth, wrap.clientHeight);
        return;
      }

      setupCanvas();
      readCharColor();
      const wrapRect = wrap.getBoundingClientRect();
      const { w, h, scaleX, scaleY } = localScale(wrap, wrapRect);
      metrics = metricsFor(w);
      gridCols = Math.max(1, Math.floor(w / metrics.step));
      gridRows = Math.max(1, Math.floor(h / metrics.step));

      const logoRect = logoImg.getBoundingClientRect();
      const sampler = document.createElement("canvas");
      sampler.width = gridCols;
      sampler.height = gridRows;
      const samplerContext = sampler.getContext("2d");
      if (!samplerContext) return;

      samplerContext.drawImage(
        logoImg,
        (logoRect.left - wrapRect.left) / scaleX / metrics.step,
        (logoRect.top - wrapRect.top) / scaleY / metrics.step,
        logoRect.width / scaleX / metrics.step,
        logoRect.height / scaleY / metrics.step,
      );
      const { data } = samplerContext.getImageData(0, 0, gridCols, gridRows);

      const litCells = new Set<string>();
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const pixel = (row * gridCols + col) * 4;
          const alpha = data[pixel + 3] / 255;
          const brightness =
            ((data[pixel] * 0.299 +
              data[pixel + 1] * 0.587 +
              data[pixel + 2] * 0.114) /
              255) *
            alpha;
          if (brightness > BRIGHTNESS_THRESHOLD) {
            litCells.add(`${col},${row}`);
            if (col + 1 < gridCols) litCells.add(`${col + 1},${row}`);
          }
        }
      }

      cells = [];
      for (const key of litCells) {
        const [col, row] = key.split(",").map(Number);
        cells.push({
          col,
          row,
          char: randomAsciiChar(),
          offsetX: 0,
          offsetY: 0,
          fallSpeed: 0,
          wait: 0,
          scatterX: (Math.random() - 0.5) * SCATTER_RANGE,
          scatterY: (Math.random() - 0.5) * SCATTER_RANGE,
        });
      }
      phase = "logo";
      syncCursorLabel();
    };

    const staggerCells = () => {
      for (const cell of cells) {
        cell.wait = Math.floor(Math.random() * STAGGER_FRAMES);
      }
    };

    const updateAsciiCells = () => {
      let everyoneHome = phase === "returning";

      for (const cell of cells) {
        if (cell.wait > 0) {
          cell.wait--;
          everyoneHome = false;
          continue;
        }

        switch (phase) {
          case "scattered":
            easeToward(cell, cell.scatterX, cell.scatterY, SCATTER_EASE);
            break;
          case "fallen": {
            const floorOffset = gridRows - 1 - cell.row;
            cell.fallSpeed += GRAVITY;
            cell.offsetY += cell.fallSpeed;
            if (cell.offsetY > floorOffset) {
              cell.offsetY = floorOffset;
              cell.fallSpeed *= -BOUNCE;
            }
            break;
          }
          case "returning":
            easeToward(cell, 0, 0, RESET_EASE);
            if (
              Math.abs(cell.offsetX) > 0.05 ||
              Math.abs(cell.offsetY) > 0.05
            ) {
              everyoneHome = false;
            }
            break;
          case "logo": {
            let targetX = 0;
            let targetY = 0;
            const distX = cell.col - cursor.col;
            const distY = cell.row - cursor.row;
            const distance = Math.sqrt(distX * distX + distY * distY);
            if (distance < HOVER_RADIUS && distance > 0) {
              const push = (1 - distance / HOVER_RADIUS) * HOVER_PUSH;
              targetX = (distX / distance) * push;
              targetY = (distY / distance) * push;
            }
            easeToward(cell, targetX, targetY, HOVER_EASE);
            break;
          }
          default: {
            const _exhaustive: never = phase;
            void _exhaustive;
          }
        }
      }

      if (everyoneHome) {
        phase = "logo";
        syncCursorLabel();
      }
    };

    const drawAscii = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (cells.length === 0) return;
      ctx.font = `${metrics.fontSize}px ${MONO_FONT}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      ctx.fillStyle = charColor;
      for (const { col, row, char, offsetX, offsetY } of cells) {
        const x = (col + offsetX) * metrics.step + metrics.size / 2;
        const y = (row + offsetY) * metrics.step;
        ctx.fillText(char, x, y);
      }
    };

    const renderLoop = () => {
      if (disposed || !running) return;
      if (cells.length > 0) {
        updateAsciiCells();
        drawAscii();
      }
      raf = requestAnimationFrame(renderLoop);
    };

    const startLoop = () => {
      if (disposed || running) return;
      running = true;
      raf = requestAnimationFrame(renderLoop);
    };

    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    /* Without a pointer nothing pushes, scatters or falls, so the wordmark is
       static and a rAF loop would repaint an unchanging canvas forever. Paint
       once on those viewports and leave the frame budget alone. */
    const rebuild = () => {
      buildAsciiFromLogo();
      if (!cursorOn()) drawAscii();
    };

    const syncEnabled = () => {
      if (disposed) return;
      syncCursorMode();
      if (!enabled()) {
        stopLoop();
        cells = [];
        ctx.clearRect(0, 0, wrap.clientWidth, wrap.clientHeight);
        setCursorVisible(false);
        return;
      }
      rebuild();
      if (cursorOn()) startLoop();
      else stopLoop();
    };

    const pointerOverUi = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest("a, button"));

    const onPointerMove = (event: PointerEvent) => {
      // Bail before touching `cursor`, or a tap on a touch device would park a
      // hover push in the middle of an otherwise static wordmark.
      if (!cursorOn()) return;

      const wrapRect = wrap.getBoundingClientRect();
      const { scaleX, scaleY } = localScale(wrap, wrapRect);
      cursor.col = (event.clientX - wrapRect.left) / scaleX / metrics.step;
      cursor.row = (event.clientY - wrapRect.top) / scaleY / metrics.step;

      const x = (event.clientX - wrapRect.left) / scaleX;
      const y = (event.clientY - wrapRect.top) / scaleY;
      cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      setCursorVisible(!pointerOverUi(event.target));
    };

    const onPointerLeave = () => {
      setCursorVisible(false);
    };

    const onClick = (event: MouseEvent) => {
      // `cursorOn`, not `enabled`: the scatter is a pointer affordance, and a
      // tap that dismantles the footer lockup with no cursor label explaining
      // it is not one.
      if (!cursorOn() || cells.length === 0) return;
      if (pointerOverUi(event.target)) return;

      switch (phase) {
        case "logo":
          phase = "scattered";
          staggerCells();
          break;
        case "scattered":
          phase = "fallen";
          for (const cell of cells) cell.fallSpeed = 0;
          break;
        case "fallen":
          phase = "returning";
          staggerCells();
          break;
        case "returning":
          break;
        default: {
          const _exhaustive: never = phase;
          void _exhaustive;
        }
      }
      syncCursorLabel();
    };

    const fontsReady =
      document.fonts?.load(`${FONT_SIZE}px "Duforn Mono"`) ?? Promise.resolve();

    const startWhenReady = () => {
      void fontsReady.then(syncEnabled);
    };

    box.addEventListener("pointermove", onPointerMove, { passive: true });
    box.addEventListener("pointerleave", onPointerLeave);
    box.addEventListener("click", onClick);
    desktopMq.addEventListener("change", syncEnabled);
    reduceMq.addEventListener("change", syncEnabled);
    fineHoverMq.addEventListener("change", syncCursorMode);

    const themeObserver = new MutationObserver(readCharColor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    if (logoImg.complete && logoImg.naturalWidth > 0) {
      startWhenReady();
    } else {
      logoImg.addEventListener("load", startWhenReady, { once: true });
    }

    const ro = new ResizeObserver(() => {
      if (enabled()) rebuild();
    });
    ro.observe(wrap);
    ro.observe(logoImg);

    return () => {
      disposed = true;
      stopLoop();
      box.removeEventListener("pointermove", onPointerMove);
      box.removeEventListener("pointerleave", onPointerLeave);
      box.removeEventListener("click", onClick);
      desktopMq.removeEventListener("change", syncEnabled);
      reduceMq.removeEventListener("change", syncEnabled);
      fineHoverMq.removeEventListener("change", syncCursorMode);
      box.classList.remove("is-ascii-hover");
      themeObserver.disconnect();
      ro.disconnect();
    };
  }, [sourceRef]);

  return (
    <>
      <div className="footer-ascii" ref={wrapRef} aria-hidden="true">
        <canvas className="footer-ascii__canvas" ref={canvasRef} />
      </div>
      <div className="footer-ascii__cursor" ref={cursorRef} aria-hidden="true">
        <span className="footer-ascii__cursor-label" ref={cursorLabelRef}>
          SCATTER
        </span>
      </div>
    </>
  );
}
