/**
 * `cssColor.ts`'s pass-through colour, built from `three/webgpu`'s `Color`.
 *
 * ponytail: a second one-line module rather than a generic over the Color class.
 * The two `Color` classes are structurally identical and mutually unassignable —
 * `three` and `three/webgpu` are separate bundles — so a shared implementation
 * would need a cast at exactly the boundary this whole split exists to police.
 * The parsing is `setStyle`'s either way, so nothing is duplicated but the call.
 */
import { Color, LinearSRGBColorSpace } from "three/webgpu";

export { readCssColor } from "./cssToken";

/**
 * A Color whose channels are the literal sRGB values, with no conversion.
 *
 * `new Color('#e2e2dd')` does NOT do this: it routes through
 * `setStyle(style, SRGBColorSpace)`, and with ColorManagement enabled (the
 * default) that converts into the linear working space. Combined with the
 * missing output encode, the plate would land in the framebuffer linearised and
 * read visibly darker than the CSS band it has to match. Declaring the input as
 * already-working-space is what makes it a pass-through — and it stays true
 * under `WebGPURenderer` only because every stage sets
 * `outputColorSpace = LinearSRGBColorSpace` (see `canvasStage.ts`).
 */
export function shaderColor(css: string): Color {
  return new Color().setStyle(css, LinearSRGBColorSpace);
}
