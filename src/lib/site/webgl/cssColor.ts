/**
 * CSS token → shader color, for raw ShaderMaterials that paint the theme surface.
 *
 * Used by the fluid backdrop, which writes gl_FragColor by hand, so it needs
 * the same no-conversion path described below.
 */
import * as THREE from "three";

/**
 * Re-exported from `cssToken.ts`, which has no `three` import, so a WebGPU
 * module can read a theme token without pulling a second copy of the library in.
 */
export { readCssColor } from "./cssToken";

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
