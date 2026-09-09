/**
 * One `GPUDevice` for the whole document, and the switch that forces WebGL2.
 *
 * The home page mounts six canvases at once — the fluid backdrop, three Process
 * cards, the Team cylinder and the footer wordmark — and `/about` adds the bust.
 * `WebGPUBackend.init()` calls `requestAdapter()` + `requestDevice()` per
 * backend, so a renderer per canvas is six devices, six pipeline caches, and the
 * ASCII shader compiled from scratch six times.
 *
 * `WebGPUBackend` has an explicit escape: when `parameters.device` is supplied
 * it skips both requests and adopts the device. So every stage shares this one.
 * It is properly typed too — `WebGPURendererParameters` extends
 * `WebGPUBackendParameters`, which declares `device?: GPUDevice` — despite
 * being absent from `WebGPURenderer`'s own JSDoc options list.
 *
 * ponytail: resolves to `undefined` rather than rejecting when WebGPU is
 * missing. `undefined` is the documented "request your own" value, and
 * `WebGPURenderer` installs a `getFallback` hook that swaps in `WebGLBackend`
 * when WebGPU is unavailable — so one code path covers both backends and there
 * is no support probe to keep in sync. The old `useWebglSupport` hook existed
 * because three throws on a null context with no error boundary to catch it;
 * `renderer.init()` rejecting is that probe now, and it covers WebGPU and
 * WebGL2 in one shot.
 */

let pending: Promise<GPUDevice | undefined> | null = null;
let generation = 0;

/**
 * The shared device, or `undefined` if WebGPU is unavailable or the request
 * failed. Memoized: every caller after the first gets the same promise.
 */
export function sharedGpuDevice(): Promise<GPUDevice | undefined> {
  if (pending) return pending;

  const gen = ++generation;
  pending = (async () => {
    if (typeof navigator === "undefined" || !navigator.gpu) return undefined;
    if (forceWebGL()) return undefined;
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });
      if (!adapter) return undefined;
      const device = await adapter.requestDevice();
      // A lost device cannot be reused, and every stage holds this one. Drop the
      // memo so the next mount requests a fresh device instead of adopting a
      // dead one; the stages already up are gone either way.
      void device.lost.then(() => {
        if (generation === gen) pending = null;
      });
      return device;
    } catch {
      return undefined;
    }
  })();

  return pending;
}

/**
 * Whether to force the WebGL2 backend, from `?webgl` on the URL.
 *
 * ponytail: a URL flag rather than an env var or a code edit. The WebGL2
 * fallback is a promise this site makes to Safari below 26 and older Firefox,
 * and a promise nobody exercises is a promise that breaks — TSL compiles to
 * both WGSL and GLSL, but compute shaders have no WebGL2 path at all, so an
 * accidental `storage()` or `computeAsync()` blanks the backdrop on those
 * browsers and nothing else in the pipeline notices. Making the fallback one
 * query parameter away is what makes checking it routine.
 */
export function forceWebGL(): boolean {
  if (typeof location === "undefined") return false;
  try {
    return new URLSearchParams(location.search).has("webgl");
  } catch {
    return false;
  }
}
