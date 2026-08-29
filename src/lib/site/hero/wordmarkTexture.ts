/**
 * `name-hero.svg` as a texture the glass can refract.
 *
 * The DOM lockup paints the same file as a CSS mask tinted by `var(--text)`
 * (`.name_hero_lockup` in `Menu.css`); every path in it is `fill="white"`, so a
 * straight raster works the same way here — white RGB, real alpha, and the
 * material's `uColor` does the tinting.
 *
 * ponytail: the canvas is padded well past the mark. The melt blurs by 0.45em of
 * the lockup's height and then thresholds, so a raster cropped to the glyph box
 * would clamp its own halo at the edge and square off the melt. The CSS filter
 * region (`GooeyFilter.astro`, `y: -120% height: 340%`) reserves the same room
 * for the same reason.
 */
import * as THREE from "three";

const SVG_URL = "/main-assets/name-hero.svg";

/** Intrinsic box of the file, and therefore the mark's aspect. */
export const MARK_ASPECT = 363 / 44;

/** Transparent margin on each side, as a fraction of the mark's *height*. */
export const TEXTURE_PAD = 0.75;

/** Ceiling on either axis. A 4k-wide lockup on a 3x phone would otherwise ask
 *  for a texture no driver will allocate. */
const MAX_EDGE = 4096;

export type WordmarkTexture = {
  texture: THREE.CanvasTexture;
  /** Texture pixels per CSS pixel — the melt's blur radius arrives in CSS px. */
  pixelRatio: number;
  width: number;
  height: number;
};

let svgImage: Promise<HTMLImageElement> | null = null;

/** One decode for the life of the tab; re-rasterising on resize reuses it. */
function loadSvg(): Promise<HTMLImageElement> {
  svgImage ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`${SVG_URL} failed to load`));
    img.src = SVG_URL;
  });
  return svgImage;
}

/**
 * Rasterise at `markWidth` CSS px wide (the measured width of
 * `.name_hero_lockup`), scaled by `dpr` and padded.
 *
 * Mipmapped on purpose: the melt shader reads a mip level to stand in for the
 * wide half of its gaussian, so a texture without a chain has nothing to read.
 */
export async function createWordmarkTexture(
  markWidth: number,
  dpr: number,
): Promise<WordmarkTexture> {
  const img = await loadSvg();

  const markHeight = markWidth / MARK_ASPECT;
  const padCss = markHeight * TEXTURE_PAD;
  const cssWidth = markWidth + padCss * 2;
  const cssHeight = markHeight + padCss * 2;

  const pixelRatio = Math.min(dpr, MAX_EDGE / Math.max(cssWidth, cssHeight, 1));
  const width = Math.max(2, Math.round(cssWidth * pixelRatio));
  const height = Math.max(2, Math.round(cssHeight * pixelRatio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  // The file carries width/height plus a viewBox, so the browser rasterises it
  // at the destination box rather than at its intrinsic 363x44.
  ctx.drawImage(
    img,
    padCss * pixelRatio,
    padCss * pixelRatio,
    markWidth * pixelRatio,
    markHeight * pixelRatio,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.premultiplyAlpha = false;
  texture.needsUpdate = true;

  return { texture, pixelRatio, width, height };
}
