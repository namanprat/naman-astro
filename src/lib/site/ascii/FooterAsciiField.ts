/**
 * Desktop footer wordmark — Duforn atlas + asciiFieldShader, spring push from
 * the interactive-ascii-logo snippet. Samples `.footer_logo` rather than a
 * separate PNG. Not an R3F canvas: one extra WebGL context is enough.
 */
import * as THREE from "three";
import { shaderColor } from "../cssColor";
import { getDufornAsciiAtlas } from "./asciiAtlas";
import { ASCII_FIELD_FRAG, ASCII_FIELD_VERT } from "./asciiFieldShader";

const CELL_SIZE = 8;
const CELL_GAP = 2;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const BRIGHTNESS_THRESHOLD = 0.5;
const PUSH_RADIUS = 5;
const PUSH_FORCE = 30;
const SPRING = 0.025;
const DAMPING = 0.5;
const FLICKER_MS = 50;
const CHAR_COLOR_FALLBACK = "#f14827";

const blankHighlight = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
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
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  private readonly abort = new AbortController();

  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.InstancedBufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private sceneTexture: THREE.DataTexture | null = null;
  private atlasTexture: THREE.CanvasTexture | null = null;
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
  private raf = 0;
  private ready = false;

  constructor(
    wrap: HTMLElement,
    canvas: HTMLCanvasElement,
    logoImg: HTMLImageElement,
    box: HTMLElement,
    reduced: boolean,
  ) {
    this.wrap = wrap;
    this.logoImg = logoImg;
    this.box = box;
    this.reduced = reduced;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

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
    this.atlasTexture?.dispose();
    const gl = this.renderer.getContext();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.renderer.dispose();
  }

  private async boot(): Promise<void> {
    try {
      const atlas = await getDufornAsciiAtlas();
      if (this.disposed) {
        atlas.texture.dispose();
        return;
      }
      this.atlasTexture = atlas.texture;
      this.material = new THREE.ShaderMaterial({
        vertexShader: ASCII_FIELD_VERT,
        fragmentShader: ASCII_FIELD_FRAG,
        uniforms: {
          uScene: { value: null },
          uAtlas: { value: atlas.texture },
          uHighlight: { value: blankHighlight },
          uGlyphCount: { value: atlas.glyphCount },
          uColor: { value: shaderColor(this.readInk()) },
          uHighlightColor: { value: shaderColor(this.readInk()) },
          uHasHighlight: { value: 0 },
          uWarp: { value: 1 },
          uGamma: { value: 0.8 },
          uGlyphScale: { value: 1.15 },
          uJitter: { value: 0.02 },
          uTime: { value: 0 },
          uNoise: { value: this.reduced ? 0 : 0.45 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      this.ready = true;
      this.rebuild();
      this.startLoop();
    } catch {
      /* No atlas — the SVG wordmark underneath still reads. */
    }
  }

  rebuild(): void {
    if (this.disposed || !this.ready || !this.material) return;
    this.tearDownGrid();

    const w = Math.max(1, this.wrap.clientWidth);
    const h = Math.max(1, this.wrap.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);

    const aspect = w / h;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.updateProjectionMatrix();

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

    const base = new THREE.PlaneGeometry(this.cellW, this.cellH, 1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute("position", base.attributes.position);
    geometry.setAttribute("uv", base.attributes.uv);
    geometry.instanceCount = count;
    geometry.setAttribute(
      "aPosition",
      new THREE.InstancedBufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      "aPixelUV",
      new THREE.InstancedBufferAttribute(pixelUv, 2),
    );
    geometry.setAttribute(
      "aRandom",
      new THREE.InstancedBufferAttribute(random, 1),
    );

    this.geometry = geometry;
    this.positions = positions;
    this.random = random;
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.sampleLogo(positions);
    this.syncInk();
    this.material.uniforms.uNoise.value = this.reduced ? 0 : 0.45;
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
    const texture = new THREE.DataTexture(
      tex,
      this.cols,
      this.rows,
      THREE.RGBAFormat,
    );
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.flipY = false;
    this.sceneTexture = texture;
    if (this.material) this.material.uniforms.uScene.value = texture;
  }

  private tearDownGrid(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
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
    return getComputedStyle(this.box).color || CHAR_COLOR_FALLBACK;
  }

  private syncInk = (): void => {
    this.material?.uniforms.uColor.value.copy(shaderColor(this.readInk()));
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
    const tick = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    window.clearTimeout(this.idleTimer);
  }

  private frame(now: number): void {
    if (!this.material || !this.positions || !this.geometry) return;

    if (!this.reduced) {
      this.material.uniforms.uTime.value = now * 0.001;
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
    ) as THREE.InstancedBufferAttribute;
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
    ) as THREE.InstancedBufferAttribute;
    for (const cell of this.lit) {
      this.random[cell.index] = Math.pow(Math.random(), 4);
    }
    attr.needsUpdate = true;
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
