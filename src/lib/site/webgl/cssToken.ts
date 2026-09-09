/**
 * Read a CSS custom property as a plain sRGB colour string.
 *
 * ponytail: split out of `cssColor.ts`, which imports `three`. The read itself
 * is a `getComputedStyle` call with no renderer in it, and both sides of the
 * WebGPU migration need it — so leaving it next to a `THREE.Color` constructor
 * would force every WebGPU module that wanted a theme token to import plain
 * `three` as well, and `three` and `three/webgpu` are separate bundles whose
 * classes are not interchangeable.
 *
 * Deliberately NOT converted to linear here or anywhere downstream.
 * `colorspace_fragment` — the chunk that encodes linear → sRGB on output — is an
 * `#include` that only exists in three's built-in material shaders. A raw
 * material writing its own output gets no encoding at all, so whatever we write
 * lands in the framebuffer as-is and is read as sRGB. Converting would darken
 * the plate with nothing to convert it back, which is exactly how it drifted off
 * the CSS `--dark` band once already.
 *
 * Custom properties resolve in `getComputedStyle`, so no probe element is needed
 * — which matters, because this runs from a MutationObserver.
 */
export function readCssColor(token: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return raw || fallback;
}
