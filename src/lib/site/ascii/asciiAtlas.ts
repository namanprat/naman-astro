/**
 * Duforn Mono glyph atlas — a 1×N strip ordered sparse → dense by measured ink.
 *
 * Ported from `Archive (1)/js/app.js` `createASCIITexture()`, which baked a
 * hand-ordered dictionary and drew the dense tail through three blur passes so
 * bright cells bloom. We keep the bloom but rank the glyphs by measured alpha
 * instead of trusting a hand-sorted string — Duforn is a 68-glyph subset and its
 * density order is not the Menlo one the Archive assumed.
 */
import * as THREE from "three";

/**
 * Every character the Duforn face actually ships (cmap, 68 glyphs).
 * Anything outside this set falls through to the next family in `--mono-family`,
 * which is a different metric — so the atlas must not reach for one.
 */
export const DUFORN_GLYPHS =
  " !,.0123456789?@ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const CELL = 64;
const MONO_FONT =
  '"Duforn Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
/** Fraction of the ranked strip that gets the Archive's bloom passes. */
const BLOOM_FROM = 0.62;
const BLOOM_PASSES = 3;
const BLOOM_STEP_PX = 3;

export function readThemeInk(): string {
  const probe = document.createElement("span");
  probe.style.color = "var(--text)";
  document.documentElement.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || "#8b8b8b";
}

type AtlasBake = { canvas: HTMLCanvasElement; glyphCount: number };

let bakePromise: Promise<AtlasBake> | null = null;

async function bakeDufornAsciiAtlas(): Promise<AtlasBake> {
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

  const bloomFrom = Math.floor(n * BLOOM_FROM);
  for (let i = 0; i < n; i++) {
    const ch = ranked[i].ch;
    if (ch === " ") continue;
    const x = i * cell + cell / 2;
    // ponytail: the dense tail is stacked through widening blurs first, so the
    // brightest cells carry a halo the crisp pass then sits inside.
    if (i >= bloomFrom) {
      for (let j = BLOOM_PASSES - 1; j >= 0; j--) {
        ctx.filter = `blur(${j * BLOOM_STEP_PX}px)`;
        ctx.fillText(ch, x, cell / 2);
      }
    }
    ctx.filter = "none";
    ctx.fillText(ch, x, cell / 2);
  }
  ctx.filter = "none";

  return { canvas, glyphCount: n };
}

function textureFromBake(bake: AtlasBake): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(bake.canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Shared Duforn bake, new CanvasTexture per caller.
 *
 * ponytail: each R3F Canvas owns its own WebGL context, so they cannot share a
 * Texture object — only the source canvas. About, Team and the three Process
 * cards all land on this one bake.
 */
export async function getDufornAsciiAtlas(): Promise<{
  texture: THREE.CanvasTexture;
  glyphCount: number;
}> {
  try {
    bakePromise ??= bakeDufornAsciiAtlas();
    const bake = await bakePromise;
    return { texture: textureFromBake(bake), glyphCount: bake.glyphCount };
  } catch (err) {
    bakePromise = null;
    throw err;
  }
}
