/**
 * The glyph atlas as a WebGL texture, for the canvases still on R3F.
 *
 * The bake itself — and the reasoning behind the glyph set and the ranking —
 * lives in `asciiAtlasBake.ts`, which imports nothing. This file is only the
 * `three` wrapper around it; the WebGPU stages wrap the same bake with
 * `three/webgpu`'s `CanvasTexture` instead.
 */
import * as THREE from "three";
import { getDufornAsciiBake, type AtlasBake } from "./asciiAtlasBake";

export { DUFORN_GLYPHS } from "./asciiAtlasBake";

/**
 * Re-exported from its new home so existing callers keep working.
 *
 * It moved to `webgl/themeInk.ts` because WebGPU stages need it and this module
 * imports plain `three` — importing across that line yields two copies of the
 * library and `instanceof` failures that do not look like import problems.
 */
export { readThemeInk } from "../webgl/themeInk";

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
  const bake = await getDufornAsciiBake();
  return { texture: textureFromBake(bake), glyphCount: bake.glyphCount };
}
