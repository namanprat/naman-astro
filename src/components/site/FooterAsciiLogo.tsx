import { useEffect, useRef } from "react";
import "./FooterAsciiLogo.css";
import { DEFAULT_ASCII_CHARSET, useAsciiControls } from "./footerAsciiControls";

const WORDMARK_URL = "/main-assets/name-hero.svg";
const THRESHOLD = 0.5;
const PUSH_RADIUS = 5;
const PUSH_FORCE = 30;
const SPRING = 0.025;
const DAMPING = 0.5;
/** Fallback only — the live value is read off the wrapper's `color` at setup,
 *  so the glyphs track the panel's ink token instead of a second hardcoded hex
 *  that silently goes invisible when the panel colour changes. */
const CHAR_COLOR_FALLBACK = "#f14827";

type Cell = {
  col: number;
  row: number;
  char: string;
  isLit: boolean;
  offsetX: number;
  offsetY: number;
  velX: number;
  velY: number;
};

/**
 * Interactive ASCII wordmark — port of codegrid-artefakt-interactive-ascii-logo,
 * scoped to the footer logo slot and sampling `/main-assets/name-hero.svg`.
 */
export default function FooterAsciiLogo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLImageElement>(null);
  const controls = useAsciiControls();
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const logoImg = sourceRef.current;
    if (!wrap || !canvas || !logoImg) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const charset = () => {
      const custom = controlsRef.current.custom.trim();
      if (custom.length > 0) return custom;
      const raw = controlsRef.current.charset;
      return raw.length > 0 ? raw : DEFAULT_ASCII_CHARSET;
    };

    let cellSize = controlsRef.current.cellSize;
    let cellGap = Math.max(0, Math.round(cellSize / 4));
    let cellStep = cellSize + cellGap;
    let cols = 0;
    let rows = 0;
    let cells: Cell[] = [];
    let raf = 0;
    let scrambleId = 0;
    let idleTimer = 0;
    let disposed = false;
    let appliedCellSize = -1;
    let appliedCharset = "";
    let appliedCustom = "";
    let appliedScramble = -1;
    const mouse = { col: -999, row: -999, isMoving: false };
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    /* Inherited from .footer-box via the wrapper's `color`. */
    let charColor = getComputedStyle(wrap).color || CHAR_COLOR_FALLBACK;

    const setupCanvas = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      cellSize = controlsRef.current.cellSize;
      cellGap = Math.max(0, Math.round(cellSize / 4));
      cellStep = cellSize + cellGap;
      cols = Math.max(1, Math.floor(w / cellStep));
      rows = Math.max(1, Math.floor(h / cellStep));
      const ratio = dpr();
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    /*
      Sample into the cell grid using the SVG's intrinsic ratio, contained so a
      taller/shorter wordmark never paints past the available rows/cols.
    */
    const sampleLogoIntoCells = () => {
      const srcW = logoImg.naturalWidth || 1;
      const srcH = logoImg.naturalHeight || 1;
      let logoCols = cols;
      let logoRows = Math.max(1, Math.round(logoCols * (srcH / srcW)));
      if (logoRows > rows) {
        logoRows = Math.max(1, rows);
        logoCols = Math.max(1, Math.round(logoRows * (srcW / srcH)));
      }
      logoCols = Math.min(logoCols, cols);
      const startCol = Math.max(0, Math.round((cols - logoCols) / 2));
      const startRow = Math.max(0, Math.round((rows - logoRows) / 2));

      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = logoCols;
      sampleCanvas.height = logoRows;
      const sampleCtx = sampleCanvas.getContext("2d");
      if (!sampleCtx) return;

      sampleCtx.fillStyle = "#000";
      sampleCtx.fillRect(0, 0, logoCols, logoRows);
      sampleCtx.drawImage(logoImg, 0, 0, logoCols, logoRows);
      const { data } = sampleCtx.getImageData(0, 0, logoCols, logoRows);

      cells = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const inLogo =
            col >= startCol &&
            col < startCol + logoCols &&
            row >= startRow &&
            row < startRow + logoRows;
          let isLit = false;
          let char = " ";
          if (inLogo) {
            const idx = ((row - startRow) * logoCols + (col - startCol)) * 4;
            const brightness =
              (data[idx] * 0.299 +
                data[idx + 1] * 0.587 +
                data[idx + 2] * 0.114) /
              255;
            // SVG wordmark is white-on-transparent; treat alpha as presence.
            const alpha = data[idx + 3] / 255;
            isLit = alpha > THRESHOLD && brightness > THRESHOLD * 0.25;
            const chars = charset();
            char = isLit
              ? chars[
                  Math.min(
                    chars.length - 1,
                    Math.floor(brightness * chars.length),
                  )
                ]
              : " ";
          }
          cells.push({
            col,
            row,
            char,
            isLit,
            offsetX: 0,
            offsetY: 0,
            velX: 0,
            velY: 0,
          });
        }
      }
    };

    const renderFrame = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      /* Re-read each frame so theme toggles (light → white ink) take effect. */
      charColor = getComputedStyle(wrap).color || CHAR_COLOR_FALLBACK;
      ctx.clearRect(0, 0, w, h);
      ctx.font = `${controlsRef.current.fontSize}px "Duforn Mono"`;
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      ctx.fillStyle = charColor;
      for (const { col, row, char, isLit, offsetX, offsetY } of cells) {
        if (!isLit) continue;
        const x = (col + Math.round(offsetX)) * cellStep;
        const y = (row + Math.round(offsetY)) * cellStep;
        ctx.fillText(char, x + cellSize / 2, y);
      }
    };

    const init = () => {
      if (disposed) return;
      charColor = getComputedStyle(wrap).color || CHAR_COLOR_FALLBACK;
      setupCanvas();
      sampleLogoIntoCells();
      renderFrame();
    };

    const updatePhysics = () => {
      for (const cell of cells) {
        if (!cell.isLit) continue;
        if (mouse.isMoving) {
          const dx = cell.col + cell.offsetX - mouse.col;
          const dy = cell.row + cell.offsetY - mouse.row;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < PUSH_RADIUS && dist > 0) {
            const force = (1 - dist / PUSH_RADIUS) ** 2 * PUSH_FORCE;
            cell.velX += (dx / dist) * force;
            cell.velY += (dy / dist) * force;
          }
        }
        cell.velX += -cell.offsetX * SPRING;
        cell.velY += -cell.offsetY * SPRING;
        cell.velX *= DAMPING;
        cell.velY *= DAMPING;
        cell.offsetX += cell.velX;
        cell.offsetY += cell.velY;
        if (Math.abs(cell.offsetX) < 0.01 && Math.abs(cell.velX) < 0.01) {
          cell.offsetX = cell.velX = 0;
        }
        if (Math.abs(cell.offsetY) < 0.01 && Math.abs(cell.velY) < 0.01) {
          cell.offsetY = cell.velY = 0;
        }
      }
    };

    const startScramble = () => {
      window.clearInterval(scrambleId);
      scrambleId = 0;
      const ms = controlsRef.current.scrambleMs;
      if (ms <= 0) return;
      scrambleId = window.setInterval(() => {
        const chars = charset();
        for (const cell of cells) {
          if (cell.isLit) {
            cell.char = chars[Math.floor(Math.random() * chars.length)];
          }
        }
      }, ms);
    };

    const syncControls = () => {
      const c = controlsRef.current;
      if (
        c.cellSize !== appliedCellSize ||
        c.charset !== appliedCharset ||
        c.custom !== appliedCustom
      ) {
        appliedCellSize = c.cellSize;
        appliedCharset = c.charset;
        appliedCustom = c.custom;
        init();
      }
      if (c.scrambleMs !== appliedScramble) {
        appliedScramble = c.scrambleMs;
        startScramble();
      }
    };

    const animationLoop = () => {
      if (disposed) return;
      syncControls();
      updatePhysics();
      renderFrame();
      raf = requestAnimationFrame(animationLoop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.col = (e.clientX - rect.left) / cellStep;
      mouse.row = (e.clientY - rect.top) / cellStep;
      mouse.isMoving = true;
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        mouse.isMoving = false;
      }, 50);
    };

    const onPointerLeave = () => {
      mouse.col = mouse.row = -999;
      mouse.isMoving = false;
    };

    const onResize = () => init();

    const start = () => {
      if (disposed) return;
      appliedCellSize = controlsRef.current.cellSize;
      appliedCharset = controlsRef.current.charset;
      appliedCustom = controlsRef.current.custom;
      appliedScramble = controlsRef.current.scrambleMs;
      init();
      startScramble();
      raf = requestAnimationFrame(animationLoop);
    };

    const fontsReady =
      document.fonts?.load('16px "Duforn Mono"') ?? Promise.resolve();

    const startWhenReady = () => {
      void fontsReady.then(start);
    };

    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", onResize);

    if (logoImg.complete && logoImg.naturalWidth > 0) {
      startWhenReady();
    } else {
      logoImg.addEventListener("load", startWhenReady, { once: true });
    }

    const ro = new ResizeObserver(() => init());
    ro.observe(wrap);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearInterval(scrambleId);
      window.clearTimeout(idleTimer);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="footer-ascii" ref={wrapRef} aria-hidden="true">
      <canvas className="footer-ascii__canvas" ref={canvasRef} />
      <div className="footer-ascii__source">
        <img
          ref={sourceRef}
          src={WORDMARK_URL}
          alt=""
          decoding="async"
          draggable={false}
        />
      </div>
    </div>
  );
}
