/**
 * Duforn Mono glyph atlas — a 1×N strip ordered sparse → dense by measured ink.
 *
 * Ported from `Archive (1)/js/app.js` `createASCIITexture()`, which baked a
 * hand-ordered dictionary. The ranking here is measured instead: alpha coverage
 * per glyph, because Duforn is a 68-glyph subset whose density order is not the
 * Menlo one the Archive assumed.
 *
 * The Archive also stacked blur passes behind its dense tail. That is dropped —
 * the halo read as a drop shadow on every surface, and the ramp is short enough
 * now that it had nothing to smooth over.
 *
 * ponytail: no `three` import anywhere in this file, and it has to stay that
 * way. The bake is a 2D canvas; wrapping it in a texture is one line and lives
 * with whichever renderer wants it. Keeping the two apart is what lets a WebGPU
 * stage and an R3F canvas share one bake — `three` and `three/webgpu` are
 * separate bundles, so a module that reached for either would force every
 * consumer onto that side of the line.
 */

/**
 * Symbols only — no letters, no digits.
 *
 * ponytail: this is the whole of it. Duforn's cmap is 68 glyphs and every other
 * one is a letter or a number, so stripping those leaves exactly ` !,.?@`. Any
 * character outside that cmap falls through to the next family in
 * `--mono-family`, which is a different metric, so the ramp cannot be padded out
 * with punctuation the face does not ship.
 */
export const DUFORN_GLYPHS = " !,.?@";

const CELL = 64;
const MONO_FONT =
  '"Duforn Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export type AtlasBake = { canvas: HTMLCanvasElement; glyphCount: number };

let bakePromise: Promise<AtlasBake> | null = null;

async function bake(): Promise<AtlasBake> {
  const px = Math.round(CELL * 0.72);
  await (document.fonts?.load(`${px}px "Duforn Mono"`) ?? Promise.resolve());

  const n = DUFORN_GLYPHS.length;
  const scratch = document.createElement("canvas");
  scratch.width = CELL;
  scratch.height = CELL;
  const sctx = scratch.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!sctx) throw new Error("2D canvas unavailable");
  sctx.fillStyle = "#fff";
  sctx.font = `${px}px ${MONO_FONT}`;
  sctx.textAlign = "center";
  sctx.textBaseline = "middle";

  const ranked = [...DUFORN_GLYPHS].map((ch, order) => {
    sctx.clearRect(0, 0, CELL, CELL);
    if (ch !== " ") sctx.fillText(ch, CELL / 2, CELL / 2);
    const data = sctx.getImageData(0, 0, CELL, CELL).data;
    let ink = 0;
    for (let p = 3; p < data.length; p += 4) ink += data[p];
    return { ch, ink, order };
  });
  ranked.sort((a, b) => a.ink - b.ink || a.order - b.order);

  const cell = Math.min(CELL, Math.floor(4096 / n));
  const drawPx = Math.round(cell * 0.72);
  const canvas = document.createElement("canvas");
  canvas.width = cell * n;
  canvas.height = cell;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("2D canvas unavailable");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = `${drawPx}px ${MONO_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < n; i++) {
    const ch = ranked[i].ch;
    if (ch === " ") continue;
    ctx.fillText(ch, i * cell + cell / 2, cell / 2);
  }

  return { canvas, glyphCount: n };
}

/**
 * The shared bake. One canvas for the whole document; every renderer wraps its
 * own texture around it.
 */
export function getDufornAsciiBake(): Promise<AtlasBake> {
  bakePromise ??= bake().catch((err: unknown) => {
    bakePromise = null;
    throw err;
  });
  return bakePromise;
}
