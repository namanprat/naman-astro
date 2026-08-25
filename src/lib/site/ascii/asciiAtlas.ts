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
 */
import * as THREE from "three";

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

  for (let i = 0; i < n; i++) {
    const ch = ranked[i].ch;
    if (ch === " ") continue;
    ctx.fillText(ch, i * cell + cell / 2, cell / 2);
  }

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
