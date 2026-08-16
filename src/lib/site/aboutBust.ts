import { prefersReducedMotion } from "./prefersReducedMotion";

/** Swap this path to drop in any About-panel GLB (Draco OK). */
export const BUST_URL = "/models/bust.glb";

type DeviceTier = 0 | 1 | 2 | 3;

const BLOCKLIST = /SwiftShader|llvmpipe|Microsoft Basic Render|software/i;
const WEAK_GPU =
  /Intel.*HD\s*(Graphics\s*)?(3\d{3}|4\d{3}|5[0-4]\d{2})|Mali-[34]|Adreno \(TM\) 3|PowerVR SGX/i;

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)) return true;
  return (
    navigator.maxTouchPoints > 1 && !/Macintosh/i.test(navigator.userAgent)
  );
}

function probeWebGL(): { ok: boolean; renderer: string } {
  if (typeof document === "undefined") return { ok: false, renderer: "" };
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return { ok: false, renderer: "" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : "";
    return { ok: true, renderer };
  } catch {
    return { ok: false, renderer: "" };
  }
}

let cachedTier: DeviceTier | null = null;

function getDeviceTier(): DeviceTier {
  if (cachedTier !== null) return cachedTier;
  const { ok, renderer } = probeWebGL();
  if (!ok || BLOCKLIST.test(renderer)) cachedTier = 0;
  else if (prefersReducedMotion() || WEAK_GPU.test(renderer)) cachedTier = 1;
  else if (isMobileDevice()) cachedTier = 2;
  else cachedTier = 3;
  return cachedTier;
}

export function getAboutCanvasMaxDpr(): number {
  const tier = getDeviceTier();
  if (tier <= 2) return 1;
  return 1.5;
}

/** Tier 0 has no usable WebGL at all; tier 1 (weak GPU / reduced motion) would
 *  render, but badly. Tier 2 — mobile with a real GPU — mounts at 1x DPR. */
export function shouldMountAboutBust(): boolean {
  if (getDeviceTier() <= 1) return false;
  return !prefersReducedMotion();
}
