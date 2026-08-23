/**
 * Duforn Mono glyph atlas + cylinder ASCII shader.
 * Luminance of the work-cover atlas picks a glyph; ink is theme `--text`.
 * The full 68-glyph Duforn cut — no `/` `#` `%` from the Archive PNG.
 */
import * as THREE from "three";

/**
 * Every character the Duforn face actually ships (cmap, 68 glyphs).
 * Atlas bake reorders these sparse → dense by measured ink.
 */
export const DUFORN_GLYPHS =
  " !,.0123456789?@ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const CELL = 64;
const MONO_FONT =
  '"Duforn Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export const ASCII_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const ASCII_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uTexture;
uniform sampler2D uAsciiTexture;
uniform float uGlyphCount;
uniform float uGranularity;
uniform float uFontSize;
uniform float uSurfaceAspect;
uniform vec3 uColor;
uniform float uTime;
uniform float uNoise;
uniform float uScroll;

float random2(vec2 st) {
  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise2d(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random2(i);
  float b = random2(i + vec2(1., 0.));
  float c = random2(i + vec2(0., 1.));
  float d = random2(i + vec2(1., 1.));
  vec2 u = f * f * (3. - 2. * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1. - u.x) + (d - b) * u.x * u.y;
}

float sampleGlyph(float index, vec2 inCell) {
  inCell = clamp(inCell, 0., 1.);
  vec2 glyphUV = vec2((index + inCell.x) / uGlyphCount, inCell.y);
  return texture2D(uAsciiTexture, glyphUV).a;
}

void main() {
  float cellsV = max(uGranularity, 1.);
  float cellsU = max(uGranularity * uSurfaceAspect, 1.);
  vec2 cells = vec2(cellsU, cellsV);

  // Silhouette is locked to the mesh. Gaps do not travel.
  vec4 here = texture2D(uTexture, vUv);
  if (here.a < 0.5) discard;

  // Character lattice crawls; each cell reads the still photo under it.
  vec2 scrollUv = vUv;
  scrollUv.x = fract(vUv.x + uScroll);
  vec2 cellId = floor(scrollUv * cells);
  vec2 inCell = fract(scrollUv * cells);
  vec2 scrollCenter = (cellId + 0.5) / cells;
  vec2 photoUv = vec2(fract(scrollCenter.x - uScroll), scrollCenter.y);
  vec4 color = texture2D(uTexture, photoUv);
  if (color.a < 0.5) color = here;

  float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  float index = floor(lum * (uGlyphCount - 1.) + 0.5);
  float size = max(uFontSize, 0.05);
  vec2 glyphInCell = (inCell - 0.5) / size + 0.5;
  float outside = step(glyphInCell.x, 0.) + step(1., glyphInCell.x)
    + step(glyphInCell.y, 0.) + step(1., glyphInCell.y);
  float chr = outside > 0.5 ? 0. : sampleGlyph(index, glyphInCell);

  float flicker = 1.;
  if (uNoise > 0.001) {
    float n = noise2d(photoUv * 1000. + uTime);
    flicker = mix(1., mix(0.7, 1.15, smoothstep(0.5, 1., n)), uNoise);
  }

  gl_FragColor = vec4(uColor, chr * flicker);
}
`;

export function readThemeInk(): string {
  const probe = document.createElement("span");
  probe.style.color = "var(--text)";
  document.documentElement.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || "#8b8b8b";
}

export async function buildDufornAsciiAtlas(): Promise<{
  texture: THREE.CanvasTexture;
  glyphCount: number;
}> {
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

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return { texture, glyphCount: n };
}
