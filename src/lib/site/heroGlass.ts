/**
 * Home hero glass sculpture — the duforn-old `newlogo.glb`, re-shaded with
 * drei's MeshTransmissionMaterial. Live values live in leva; this module
 * only names the assets and gates the WebGL mount.
 */
export const HERO_SCENE_URL = "/models/hero-scene.glb";
export const HERO_WORDMARK_URL = "/main-assets/name-hero.svg";

/** No usable WebGL — skip the island rather than throwing from R3F. */
export function canMountHeroGlass(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    return !!gl;
  } catch {
    return false;
  }
}

/** Same opt-in as `asciiGui.ts`: astro dev above phone width, or `?glass-gui`. */
export function heroGlassGuiEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("glass-gui")) return true;
  /* Mirrors `MOBILE_LAYOUT_MQ` — inlined so this file stays a node-importable leaf. */
  if (window.matchMedia("(width < 48rem)").matches) return false;
  return import.meta.env.DEV;
}
