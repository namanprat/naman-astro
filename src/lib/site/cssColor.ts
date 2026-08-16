/**
 * CSS token → shader color, for raw ShaderMaterials that paint the theme surface.
 *
 * Used by the fluid backdrop, which writes gl_FragColor by hand, so it needs
 * the same no-conversion path described below.
 */
import * as THREE from "three";

/**
 * Read a CSS custom property as a plain sRGB color.
 *
 * Deliberately NOT converted to linear. `colorspace_fragment` — the chunk that
 * encodes linear → sRGB on output — is an `#include` that only exists in three's
 * built-in material shaders. A raw ShaderMaterial writing gl_FragColor by hand
 * gets no output encoding at all, so whatever we write lands in the framebuffer
 * as-is and is read as sRGB. Converting here would darken the plate with nothing
 * to convert it back, which is exactly how it drifted off the CSS `--dark` band.
 *
 * Custom properties resolve in getComputedStyle, so no probe element is needed —
 * which matters, because this runs from a MutationObserver.
 */
export function readCssColor(token: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return raw || fallback;
}

/**
 * Build a Color whose channels are the literal sRGB values, with no conversion.
 *
 * `new THREE.Color('#e2e2dd')` does NOT do this: it routes through
 * `setStyle(style, SRGBColorSpace)`, and with ColorManagement enabled (the
 * default) that converts into the linear working space. Combined with the
 * missing output encode above, the plate would land in the framebuffer
 * linearised and read visibly darker than the CSS band it has to match.
 * Declaring the input as already-working-space is what makes it a pass-through.
 */
export function shaderColor(css: string): THREE.Color {
  return new THREE.Color().setStyle(css, THREE.LinearSRGBColorSpace);
}
