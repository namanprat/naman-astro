/**
 * Desktop footer wordmark — Duforn atlas + the shared ASCII node graph, spring
 * push from the interactive-ascii-logo snippet. Samples `.footer_logo` rather
 * than a separate PNG.
 *
 * ponytail: the lattice is built here rather than with `asciiGridData.ts`. That
 * one lays cells out from the bottom up over a density figure; this one derives
 * its rows and columns from `CELL_STEP` in CSS pixels and counts from the *top*,
 * because every cell has to line up with the pixel of `.footer_logo` it sampled.
 * They look like the same grid and are not.
 *
 * ponytail: it drives a `canvasStage` rather than owning a renderer, which it
 * used to. The stage is what shares one `GPUDevice` with the rest of the page —
 * this surface booting its own would mean a second device for a wordmark.
 */
import {
  DataTexture,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  type Texture,
} from "three/webgpu";
import { shaderColor } from "../webgl/cssColorGpu";
import { footerAsciiInk } from "../webgl/siteColors";
import { createCanvasStage, type CanvasStage } from "../webgl/canvasStage";
import { getDufornAsciiBake } from "./asciiAtlasBake";
import {
  atlasTexture,
  createAsciiFieldMaterial,
  type AsciiFieldUniforms,
} from "./asciiFieldNodes";

const CELL_SIZE = 8;
const CELL_GAP = 2;
/** 30% more cells than the original 10px lattice. */
const CELL_STEP = (CELL_SIZE + CELL_GAP) / 1.3;
const BRIGHTNESS_THRESHOLD = 0.5;
const PUSH_RADIUS = 5;
const PUSH_FORCE = 30;
const SPRING = 0.025;
const DAMPING = 0.5;
const FLICKER_MS = 50;
const CHAR_NOISE = 0.85;
const CHAR_JITTER = 0.12;

const blankHighlight = (() => {
  const tex = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  tex.needsUpdate = true;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  return tex;
})();

type LitCell = {
  index: number;
  col: number;
  row: number;
  restX: number;
  restY: number;
  offsetX: number;
  offsetY: number;
  velX: number;
  velY: number;
};

function localScale(wrap: HTMLElement, wrapRect: DOMRect) {
  const w = Math.max(1, wrap.clientWidth);
  const h = Math.max(1, wrap.clientHeight);
  return {
    w,
    h,
    scaleX: wrapRect.width / w || 1,
    scaleY: wrapRect.height / h || 1,
  };
}

export class FooterAsciiField {
  private readonly wrap: HTMLElement;
  private readonly logoImg: HTMLImageElement;
  private readonly box: HTMLElement;
  private readonly stage: CanvasStage;
  private readonly abort = new AbortController();

  private mesh: Mesh | null = null;
  private geometry: InstancedBufferGeometry | null = null;
  private uniforms: AsciiFieldUniforms | null = null;
  private material:
    ReturnType<typeof createAsciiFieldMaterial>["material"] | null = null;
  private sceneTexture: DataTexture | null = null;
  private atlas: Texture | null = null;
  private positions: Float32Array | null = null;
  private random: Float32Array | null = null;
  private lit: LitCell[] = [];
  private cols = 0;
  private rows = 0;
  private cellW = 1;
  private cellH = 1;
  private mouse = { col: -999, row: -999, moving: false };
  private idleTimer = 0;
  private flickerAt = 0;
  private reduced = false;
  private running = false;
  private disposed = false;
  private offFrame: (() => void) | null = null;
  private ready = false;

  /**
   * ponytail: a static factory, because `WebGPURenderer.init()` is async and the
   * node renderer throws outright from `render()` before it resolves. A
   * constructor cannot await, so the alternative is an object that exists but
   * cannot draw yet — which is exactly the state every caller would then have to
   * check for.
   */
  static async create(
    wrap: HTMLElement,
    logoImg: HTMLImageElement,
    box: HTMLElement,
    reduced: boolean,
  ): Promise<FooterAsciiField> {
    const stage = await createCanvasStage({
      host: wrap,
      canvasClass: "footer_ascii_canvas",
      alpha: true,
      antialias: false,
      dpr: [1, 2],
      clear: [0x000000, 0],
      // Screen-aligned quads: the lattice is authored in clip units directly.
      camera: (aspect) => new OrthographicCamera(-aspect, aspect, 1, -1, -1, 1),
      onResize: (size, camera) => {
        const aspect = size.width / size.height;
        const ortho = camera as OrthographicCamera;
        ortho.left = -aspect;
        ortho.right = aspect;
      },
      // Nothing to draw until the atlas and the lattice exist.
      paused: true,
    });
    return new FooterAsciiField(stage, wrap, logoImg, box, reduced);
  }

  private constructor(
    stage: CanvasStage,
    wrap: HTMLElement,
    logoImg: HTMLImageElement,
    box: HTMLElement,
    reduced: boolean,
  ) {
    this.stage = stage;
    this.wrap = wrap;
    this.logoImg = logoImg;
    this.box = box;
    this.reduced = reduced;

    // Same as `.footer_ascii_canvas { color-scheme: only light }` — keep the
    // authored ink if a parent ever restyles the canvas.
    stage.canvas.style.colorScheme = "only light";

    const { signal } = this.abort;
    this.box.addEventListener("pointermove", this.onPointerMove, {
      passive: true,
      signal,
    });
    this.box.addEventListener("pointerleave", this.onPointerLeave, { signal });

    const themeObserver = new MutationObserver(this.syncInk);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    signal.addEventListener("abort", () => themeObserver.disconnect());

    void this.boot();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    this.abort.abort();
    this.tearDownGrid();
    this.material?.dispose();
    this.material = null;
    this.atlas?.dispose();
    this.atlas = null;
    // ponytail: no WEBGL_lose_context here any more. That extension was how the
    // WebGL build gave its context straight back instead of waiting for the GC;
    // the stage's dispose covers the WebGPU and WebGL2 backends alike, and the
    // device it was using is shared with the rest of the page either way.
    this.stage.dispose();
  }

  private async boot(): Promise<void> {
    try {
      const bake = await getDufornAsciiBake();
      if (this.disposed) return;

      this.atlas = atlasTexture(bake.canvas);
      const { material, uniforms } = createAsciiFieldMaterial();
      this.material = material;
      this.uniforms = uniforms;

      uniforms.atlas.value = this.atlas;
      uniforms.highlight.value = blankHighlight;
      uniforms.glyphCount.value = bake.glyphCount;
      uniforms.hasHighlight.value = 0;
      uniforms.warp.value = 1;
      uniforms.gamma.value = 0.8;
      uniforms.glyphScale.value = 1.15;
      // Holey glyphs at atlas alpha wash to grey on the frost card; opaque ink
      // is what makes --light-100 actually read as white.
      uniforms.opaqueGlyphs.value = 1;
      this.applyMotion();

      /* The shared graph's fluid mask, which this surface does not use. It no
         longer has to be spelled out — the factory ships defaults, so `opacity`
         is 1 rather than the 0 an undeclared uniform used to read, which
         discarded every glyph and vanished the wordmark. */

      this.ready = true;
      this.rebuild();
      this.startLoop();
    } catch {
      /* No atlas — the SVG wordmark underneath still reads. */
    }
  }

  /**
   * Follow a live `prefers-reduced-motion` change.
   *
   * ponytail: the field stays and stops moving, where the React version tore it
   * down and rebuilt it. The stylesheet already hides `.footer_ascii` under the
   * reduced-motion query, so a rebuild bought nothing visible and cost a GPU
   * stage teardown on a media change the visitor can toggle at will.
   */
  setReduced(reduced: boolean): void {
    if (this.reduced === reduced) return;
    this.reduced = reduced;
    this.applyMotion();
    if (reduced) this.stopLoop();
    else this.startLoop();
    this.render();
  }

  /** Motion-sensitive knobs, re-applied on rebuild and on a preference change. */
  private applyMotion(): void {
    const u = this.uniforms;
    if (!u) return;
    u.noise.value = this.reduced ? 0 : 0.45;
    u.charNoise.value = this.reduced ? 0 : CHAR_NOISE;
    u.jitter.value = this.reduced ? 0 : CHAR_JITTER;
  }

  rebuild(): void {
    if (this.disposed || !this.ready || !this.material) return;
    this.tearDownGrid();

    // The stage owns the drawing buffer and the camera box; this only needs the
    // CSS size the lattice is measured in.
    const w = this.stage.size.width;
    const h = this.stage.size.height;
    const aspect = w / h;

    this.cols = Math.max(1, Math.floor(w / CELL_STEP));
    this.rows = Math.max(1, Math.floor(h / CELL_STEP));
    this.cellW = (2 * aspect) / this.cols;
    this.cellH = 2 / this.rows;

    const count = this.cols * this.rows;
    const positions = new Float32Array(count * 3);
    const pixelUv = new Float32Array(count * 2);
    const random = new Float32Array(count);

    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows; row++) {
        const index = col * this.rows + row;
        // row 0 is the top of the wrap, matching the logo sample.
        const x = -aspect + (col + 0.5) * this.cellW;
        const y = 1 - (row + 0.5) * this.cellH;
        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = 0;
        pixelUv[index * 2] = (col + 0.5) / this.cols;
        pixelUv[index * 2 + 1] = 1 - (row + 0.5) / this.rows;
        random[index] = Math.pow(Math.random(), 4);
      }
    }

    const base = new PlaneGeometry(this.cellW, this.cellH, 1, 1);
    const geometry = new InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute("position", base.attributes.position);
    geometry.setAttribute("uv", base.attributes.uv);
    geometry.instanceCount = count;
    geometry.setAttribute(
      "aPosition",
      new InstancedBufferAttribute(positions, 3),
    );
    geometry.setAttribute("aPixelUV", new InstancedBufferAttribute(pixelUv, 2));
    geometry.setAttribute("aRandom", new InstancedBufferAttribute(random, 1));

    this.geometry = geometry;
    this.positions = positions;
    this.random = random;
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.stage.scene.add(this.mesh);

    this.sampleLogo(positions);
    this.syncInk();
    this.applyMotion();
    this.render();
  }

  private sampleLogo(positions: Float32Array): void {
    const wrapRect = this.wrap.getBoundingClientRect();
    const { scaleX, scaleY } = localScale(this.wrap, wrapRect);
    const logoRect = this.logoImg.getBoundingClientRect();

    const sampler = document.createElement("canvas");
    sampler.width = this.cols;
    sampler.height = this.rows;
    const ctx = sampler.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, this.cols, this.rows);
    ctx.drawImage(
      this.logoImg,
      (logoRect.left - wrapRect.left) / scaleX / CELL_STEP,
      (logoRect.top - wrapRect.top) / scaleY / CELL_STEP,
      logoRect.width / scaleX / CELL_STEP,
      logoRect.height / scaleY / CELL_STEP,
    );
    const { data } = ctx.getImageData(0, 0, this.cols, this.rows);
    const tex = new Uint8Array(this.cols * this.rows * 4);
    this.lit = [];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const pixel = (row * this.cols + col) * 4;
        const alpha = data[pixel + 3] / 255;
        const brightness =
          ((data[pixel] * 0.299 +
            data[pixel + 1] * 0.587 +
            data[pixel + 2] * 0.114) /
            255) *
          alpha;
        const lit = brightness > BRIGHTNESS_THRESHOLD;
        const texRow = this.rows - 1 - row;
        const texi = (texRow * this.cols + col) * 4;
        if (lit) {
          const v = Math.round(brightness * 255);
          tex[texi] = v;
          tex[texi + 1] = v;
          tex[texi + 2] = v;
          tex[texi + 3] = 255;
          const index = col * this.rows + row;
          this.lit.push({
            index,
            col,
            row,
            restX: positions[index * 3],
            restY: positions[index * 3 + 1],
            offsetX: 0,
            offsetY: 0,
            velX: 0,
            velY: 0,
          });
        }
      }
    }

    this.sceneTexture?.dispose();
    const texture = new DataTexture(tex, this.cols, this.rows, RGBAFormat);
    texture.needsUpdate = true;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.flipY = false;
    this.sceneTexture = texture;
    if (this.uniforms) this.uniforms.scene.value = texture;
  }

  private tearDownGrid(): void {
    if (this.mesh) {
      this.stage.scene.remove(this.mesh);
      this.mesh = null;
    }
    this.geometry?.dispose();
    this.geometry = null;
    this.sceneTexture?.dispose();
    this.sceneTexture = null;
    this.positions = null;
    this.random = null;
    this.lit = [];
  }

  private readInk(): string {
    return footerAsciiInk(
      document.documentElement.classList.contains("theme-light"),
    );
  }

  private syncInk = (): void => {
    if (!this.uniforms) return;
    const color = shaderColor(this.readInk());
    this.uniforms?.color.value.copy(color);
    this.uniforms?.highlightColor.value.copy(color);
    this.render();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.reduced) return;
    const wrapRect = this.wrap.getBoundingClientRect();
    const { scaleX, scaleY } = localScale(this.wrap, wrapRect);
    this.mouse.col = (event.clientX - wrapRect.left) / scaleX / CELL_STEP;
    this.mouse.row = (event.clientY - wrapRect.top) / scaleY / CELL_STEP;
    this.mouse.moving = true;
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.mouse.moving = false;
    }, 50);
  };

  private onPointerLeave = (): void => {
    this.mouse.col = -999;
    this.mouse.row = -999;
    this.mouse.moving = false;
  };

  private startLoop(): void {
    if (this.disposed || this.running) return;
    this.running = true;
    this.offFrame = this.stage.onFrame((_dt, elapsed) => {
      this.frame(elapsed * 1000);
    });
    this.stage.setPaused(false);
  }

  private stopLoop(): void {
    this.running = false;
    this.offFrame?.();
    this.offFrame = null;
    this.stage.setPaused(true);
    window.clearTimeout(this.idleTimer);
  }

  private frame(now: number): void {
    if (!this.uniforms || !this.positions || !this.geometry) return;

    if (!this.reduced) {
      this.uniforms.time.value = now * 0.001;
      this.updatePhysics();
      if (now - this.flickerAt >= FLICKER_MS) {
        this.flickerAt = now;
        this.flicker();
      }
    }

    this.render();
  }

  private updatePhysics(): void {
    if (!this.positions || !this.geometry) return;
    const attr = this.geometry.getAttribute(
      "aPosition",
    ) as InstancedBufferAttribute;
    let dirty = false;

    for (const cell of this.lit) {
      if (this.mouse.moving) {
        const dx = cell.col + cell.offsetX - this.mouse.col;
        const dy = cell.row + cell.offsetY - this.mouse.row;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PUSH_RADIUS && dist > 0) {
          const force = (1 - dist / PUSH_RADIUS) ** 2 * PUSH_FORCE;
          cell.velX += (dx / dist) * force;
          cell.velY += (dy / dist) * force;
        }
      }
      cell.velX += -cell.offsetX * SPRING;
      cell.velY += -cell.offsetY * SPRING;
      cell.velX *= DAMPING;
      cell.velY *= DAMPING;
      cell.offsetX += cell.velX;
      cell.offsetY += cell.velY;
      if (Math.abs(cell.offsetX) < 0.01 && Math.abs(cell.velX) < 0.01) {
        cell.offsetX = cell.velX = 0;
      }
      if (Math.abs(cell.offsetY) < 0.01 && Math.abs(cell.velY) < 0.01) {
        cell.offsetY = cell.velY = 0;
      }

      const x = cell.restX + cell.offsetX * this.cellW;
      const y = cell.restY - cell.offsetY * this.cellH;
      const i = cell.index * 3;
      if (this.positions[i] !== x || this.positions[i + 1] !== y) {
        this.positions[i] = x;
        this.positions[i + 1] = y;
        dirty = true;
      }
    }

    if (dirty) attr.needsUpdate = true;
  }

  private flicker(): void {
    if (!this.random || !this.geometry) return;
    const attr = this.geometry.getAttribute(
      "aRandom",
    ) as InstancedBufferAttribute;
    for (const cell of this.lit) {
      // Unbiased — pow(random, 4) sat near 0 and the glyph never jumped.
      this.random[cell.index] = Math.random();
    }
    attr.needsUpdate = true;
  }

  /**
   * Draw one frame while the loop is parked.
   *
   * ponytail: `invalidate`, not a direct `render`. Booting, a theme change and a
   * rebuild all need the wordmark repainted at a moment the loop may not be
   * running, and calling the renderer straight would draw before the stage has
   * re-fitted its buffer to a resize it has already observed.
   */
  private render(): void {
    this.stage.invalidate();
  }
}
