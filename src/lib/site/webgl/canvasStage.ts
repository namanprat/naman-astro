/**
 * One canvas: renderer, scene, camera, sizing, loop, teardown.
 *
 * This is the whole of what `<Canvas>` did for this site, minus React. A stage
 * owns a `WebGPURenderer` on a canvas appended to `host`, keeps the drawing
 * buffer matched to the host box, and runs an ordered callback list (see
 * `frameBus.ts`) followed by a draw.
 *
 * ponytail: one renderer per canvas, all sharing a single `GPUDevice`, rather
 * than one renderer drawing into several canvases. The single-renderer form
 * exists — `renderer.setCanvasTarget()` — but it is WebGPU-only: `WebGLBackend`
 * has no canvas-target path and configures the one context it was built with,
 * so under the WebGL2 fallback every stage would draw into whichever canvas
 * happened to be first. The expensive part of N renderers is N devices, and
 * `gpuDevice.ts` already removes that.
 *
 * ponytail: `createCanvasStage` is async and nothing here is usable before it
 * resolves. The node `Renderer` throws outright from `render()`, `clear()`,
 * `initTexture()` and friends when called before `init()` — `renderAsync()` was
 * the old way around that and is deprecated as of r181. So the shape is: await
 * `init()` once here, then call plain synchronous `render()` forever after, and
 * no consumer ever holds an uninitialised renderer.
 */
import * as THREE from "three/webgpu";
import { createFrameBus, type FrameCallback } from "./frameBus";
import { forceWebGL, sharedGpuDevice } from "./gpuDevice";

export type CanvasStageOptions = {
  /** A laid-out box. The canvas is appended to it and pinned to 100%/100%. */
  host: HTMLElement;
  /** Defaults to `PerspectiveCamera(35, aspect, 0.1, 50)`. */
  camera?: (
    aspect: number,
  ) => THREE.PerspectiveCamera | THREE.OrthographicCamera;
  /**
   * Re-fit the camera when the host box changes.
   *
   * ponytail: a hook, because only a perspective camera resizes by itself. The
   * stage keeps `aspect` current for one of those and calls this either way —
   * an orthographic stage (the footer wordmark, the ASCII glyph grid) has to
   * move `left`/`right` instead, and the numbers are the surface's business.
   */
  onResize?: (
    size: { width: number; height: number },
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  ) => void;
  /** Clamped device pixel ratio, as R3F's `dpr` prop. Default `[1, 1.75]`. */
  dpr?: readonly [min: number, max: number];
  alpha?: boolean;
  antialias?: boolean;
  /** `[hex, alpha]`, applied after init. Default `[0x000000, 0]`. */
  clear?: readonly [color: number, alpha: number];
  /** Start parked, for a stage an IntersectionObserver will wake. */
  paused?: boolean;
  /** Extra classes for the canvas element. */
  canvasClass?: string;
};

export type CanvasStage = {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  canvas: HTMLCanvasElement;
  /** CSS pixels, kept current by one ResizeObserver on the host. */
  readonly size: { width: number; height: number };
  /** Ascending priority; equal priorities keep subscription order. */
  onFrame(fn: FrameCallback, priority?: number): () => void;
  /** Take over the draw entirely, as `AsciiField` does. `null` gives it back. */
  setRender(fn: (() => void) | null): void;
  /** Park or resume the loop — R3F's `frameloop` prop. */
  setPaused(paused: boolean): void;
  /** Draw exactly one frame while parked. */
  invalidate(): void;
  dispose(): void;
};

const DEFAULT_DPR = [1, 1.75] as const;

function defaultCamera(aspect: number): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(35, aspect, 0.1, 50);
}

export async function createCanvasStage(
  options: CanvasStageOptions,
): Promise<CanvasStage> {
  const {
    host,
    camera: makeCamera = defaultCamera,
    dpr = DEFAULT_DPR,
    alpha = true,
    antialias = true,
    clear = [0x000000, 0],
    paused = false,
    canvasClass,
    onResize,
  } = options;

  const canvas = document.createElement("canvas");
  if (canvasClass) canvas.className = canvasClass;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.appendChild(canvas);

  const size = {
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
  };

  const renderer = new THREE.WebGPURenderer({
    canvas,
    alpha,
    antialias,
    forceWebGL: forceWebGL(),
    device: await sharedGpuDevice(),
  });

  /**
   * No tone mapping, and no output encode.
   *
   * ponytail: not the defaults, and the difference is not cosmetic. The node
   * `Renderer` allocates an extra full-screen render target and runs an extra
   * output pass whenever `toneMapping !== NoToneMapping || outputColorSpace !==
   * workingColorSpace` — and `outputColorSpace` defaults to sRGB while the
   * working space is linear, so every stage would pay that per frame by
   * default. This site does not want it either way: the old `<Canvas flat>`
   * meant no tone mapping, and `cssColor.ts`'s whole contract is that a CSS
   * token reaches the framebuffer as the literal sRGB value it started as,
   * with nothing converting it in between.
   */
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  await renderer.init();

  renderer.setClearColor(clear[0], clear[1]);

  const scene = new THREE.Scene();
  const camera = makeCamera(size.width / size.height);
  const bus = createFrameBus();

  const applySize = () => {
    size.width = Math.max(1, host.clientWidth);
    size.height = Math.max(1, host.clientHeight);
    const ratio = Math.min(
      Math.max(window.devicePixelRatio || 1, dpr[0]),
      dpr[1],
    );
    renderer.setPixelRatio(ratio);
    // `false` — never write width/height back onto the canvas element's style.
    // The stylesheet owns the box; the stage owns the drawing buffer.
    renderer.setSize(size.width, size.height, false);
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      (camera as THREE.PerspectiveCamera).aspect = size.width / size.height;
    }
    onResize?.(size, camera);
    camera.updateProjectionMatrix();
  };
  applySize();

  const draw = () => {
    const override = bus.render;
    if (override) override();
    else renderer.render(scene, camera);
  };

  let last = performance.now();
  let elapsed = 0;
  const tick = () => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    bus.run(dt, elapsed);
    draw();
  };

  let disposed = false;
  let running = false;
  const start = () => {
    if (running || disposed) return;
    running = true;
    last = performance.now();
    renderer.setAnimationLoop(tick);
  };
  const stop = () => {
    if (!running) return;
    running = false;
    renderer.setAnimationLoop(null);
  };

  const observer = new ResizeObserver(() => {
    applySize();
    if (!running) draw();
  });
  observer.observe(host);

  if (!paused) start();
  else draw();

  return {
    renderer,
    scene,
    camera,
    canvas,
    size,
    onFrame: (fn, priority) => bus.add(fn, priority),
    setRender: (fn) => bus.setRender(fn),
    setPaused: (next) => (next ? stop() : start()),
    invalidate: () => {
      if (!running && !disposed) tick();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      observer.disconnect();
      bus.clear();
      renderer.dispose();
      canvas.remove();
    },
  };
}
