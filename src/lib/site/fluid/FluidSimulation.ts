/**
 * GPU stable-fluids backdrop. Port of codegrid-cappen-fluid-simulation with
 * theme ink/surface from CSS tokens instead of a difference-blend overlay.
 */
import * as THREE from "three";
import { readCssColor, shaderColor } from "../cssColor";
import { prefersReducedMotion } from "../prefersReducedMotion";
import { reportHomeCanvasReady } from "../preloadAssets";
import { SWATCH_DARK, SWATCH_LIGHT } from "../siteColors";
import shaders from "./shaders";

const COLOR_FOLLOW = 6;

const CONFIG = {
  simResolution: 256,
  dyeResolution: 1024,
  curl: 50,
  pressureIterations: 40,
  velocityDissipation: 0.95,
  dyeDissipation: 0.95,
  splatRadius: 0.3,
  forceStrength: 8.5,
  pressureDecay: 0.75,
  threshold: 1.0,
  edgeSoftness: 0.0,
} as const;

const TARGET_OPTIONS: THREE.RenderTargetOptions = {
  type: THREE.HalfFloatType,
  depthBuffer: false,
};

const lerpFactor = (delta: number, rate: number) => 1 - Math.exp(-delta * rate);

type Size = { w: number; h: number };

type PingPong = {
  read: THREE.WebGLRenderTarget;
  write: THREE.WebGLRenderTarget;
  swap: () => void;
};

type Materials = {
  splat: THREE.ShaderMaterial;
  advection: THREE.ShaderMaterial;
  divergence: THREE.ShaderMaterial;
  curl: THREE.ShaderMaterial;
  vorticity: THREE.ShaderMaterial;
  pressure: THREE.ShaderMaterial;
  gradientSubtract: THREE.ShaderMaterial;
  clear: THREE.ShaderMaterial;
  display: THREE.ShaderMaterial;
};

function makePingPong(w: number, h: number): PingPong {
  const pair: PingPong = {
    read: new THREE.WebGLRenderTarget(w, h, TARGET_OPTIONS),
    write: new THREE.WebGLRenderTarget(w, h, TARGET_OPTIONS),
    swap() {
      const tmp = this.read;
      this.read = this.write;
      this.write = tmp;
    },
  };
  return pair;
}

function disposePingPong(pair: PingPong): void {
  pair.read.dispose();
  pair.write.dispose();
}

function makeMaterial(
  [vertexShader, fragmentShader]: readonly [string, string],
  uniforms: THREE.ShaderMaterialParameters["uniforms"],
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

function tex(): THREE.IUniform<THREE.Texture | null> {
  return { value: null };
}

function num(value = 0): THREE.IUniform<number> {
  return { value };
}

function vec2(): THREE.IUniform<THREE.Vector2> {
  return { value: new THREE.Vector2() };
}

export class FluidSimulation {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly materials: Materials;
  private readonly abort = new AbortController();
  private readonly motionQuery: MediaQueryList;

  private readonly inkColor = shaderColor(SWATCH_LIGHT);
  private readonly surfaceColor = shaderColor(SWATCH_DARK);
  private readonly inkTarget = shaderColor(SWATCH_LIGHT);
  private readonly surfaceTarget = shaderColor(SWATCH_DARK);

  private readonly splatPoint = new THREE.Vector2();
  private readonly velocitySplat = new THREE.Vector3();
  private readonly dyeSplat = new THREE.Vector3(3, 3, 3);
  private readonly simTexel = new THREE.Vector2();
  private readonly dyeTexel = new THREE.Vector2();

  private velocity!: PingPong;
  private dye!: PingPong;
  private divergence!: THREE.WebGLRenderTarget;
  private curlTarget!: THREE.WebGLRenderTarget;
  private pressure!: PingPong;
  private simSize: Size = { w: 1, h: 1 };
  private dyeSize: Size = { w: 1, h: 1 };

  private dpr = 1;
  private width = 1;
  private height = 1;

  private mouse = { x: 0, y: 0, velocityX: 0, velocityY: 0, moved: false };
  private reduced = prefersReducedMotion();
  private painted = false;
  private running = false;
  private disposed = false;
  private raf = 0;
  private lastTime = 0;
  private lastTheme = { ink: "", surface: "" };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.materials = this.makeMaterials();
    this.syncSize();
    this.setupTargets();
    this.readTheme(true);

    const { signal } = this.abort;
    window.addEventListener("resize", this.onResize, { signal });
    window.addEventListener("pointermove", this.onPointerMove, {
      passive: true,
      signal,
    });
    document.addEventListener("visibilitychange", this.onVisibility, {
      signal,
    });

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.motionQuery.addEventListener("change", this.onMotionChange, {
      signal,
    });

    const observer = new MutationObserver(this.onThemeMutation);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    signal.addEventListener("abort", () => observer.disconnect());

    this.startLoop();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    this.abort.abort();
    this.disposeTargets();
    this.quad.geometry.dispose();
    for (const material of Object.values(this.materials)) {
      material.dispose();
    }
    const gl = this.renderer.getContext();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.renderer.dispose();
  }

  private makeMaterials(): Materials {
    return {
      splat: makeMaterial(shaders.splat, {
        uTarget: tex(),
        aspectRatio: num(),
        radius: num(),
        color: { value: new THREE.Vector3() },
        point: { value: this.splatPoint },
      }),
      advection: makeMaterial(shaders.advection, {
        uVelocity: tex(),
        uSource: tex(),
        texelSize: vec2(),
        dt: num(),
        dissipation: num(),
      }),
      divergence: makeMaterial(shaders.divergence, {
        uVelocity: tex(),
        texelSize: vec2(),
      }),
      curl: makeMaterial(shaders.curl, {
        uVelocity: tex(),
        texelSize: vec2(),
      }),
      vorticity: makeMaterial(shaders.vorticity, {
        uVelocity: tex(),
        uCurl: tex(),
        texelSize: vec2(),
        curlStrength: num(),
        dt: num(),
      }),
      pressure: makeMaterial(shaders.pressure, {
        uPressure: tex(),
        uDivergence: tex(),
        texelSize: vec2(),
      }),
      gradientSubtract: makeMaterial(shaders.gradientSubtract, {
        uPressure: tex(),
        uVelocity: tex(),
        texelSize: vec2(),
      }),
      clear: makeMaterial(shaders.clear, {
        uTexture: tex(),
        value: num(),
      }),
      display: makeMaterial(shaders.display, {
        uTexture: tex(),
        threshold: num(CONFIG.threshold),
        edgeSoftness: num(CONFIG.edgeSoftness),
        inkColor: { value: this.inkColor },
        surfaceColor: { value: this.surfaceColor },
      }),
    };
  }

  private syncSize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.dpr = this.renderer.getPixelRatio();
    this.width = Math.max(1, w * this.dpr);
    this.height = Math.max(1, h * this.dpr);
  }

  private setupTargets(): void {
    const aspect = this.width / this.height;
    this.simSize = {
      w: CONFIG.simResolution,
      h: Math.max(1, Math.round(CONFIG.simResolution / aspect)),
    };
    this.dyeSize = {
      w: CONFIG.dyeResolution,
      h: Math.max(1, Math.round(CONFIG.dyeResolution / aspect)),
    };
    this.simTexel.set(1 / this.simSize.w, 1 / this.simSize.h);
    this.dyeTexel.set(1 / this.dyeSize.w, 1 / this.dyeSize.h);

    this.velocity = makePingPong(this.simSize.w, this.simSize.h);
    this.dye = makePingPong(this.dyeSize.w, this.dyeSize.h);
    this.divergence = new THREE.WebGLRenderTarget(
      this.simSize.w,
      this.simSize.h,
      TARGET_OPTIONS,
    );
    this.curlTarget = new THREE.WebGLRenderTarget(
      this.simSize.w,
      this.simSize.h,
      TARGET_OPTIONS,
    );
    this.pressure = makePingPong(this.simSize.w, this.simSize.h);
  }

  private disposeTargets(): void {
    disposePingPong(this.velocity);
    disposePingPong(this.dye);
    disposePingPong(this.pressure);
    this.divergence.dispose();
    this.curlTarget.dispose();
  }

  private readTheme(snap: boolean): void {
    const next = {
      ink: readCssColor("--ink", SWATCH_LIGHT),
      surface: readCssColor("--dark", SWATCH_DARK),
    };
    if (
      next.ink === this.lastTheme.ink &&
      next.surface === this.lastTheme.surface
    ) {
      return;
    }
    this.lastTheme = next;
    this.inkTarget.copy(shaderColor(next.ink));
    this.surfaceTarget.copy(shaderColor(next.surface));
    if (snap) {
      this.inkColor.copy(this.inkTarget);
      this.surfaceColor.copy(this.surfaceTarget);
    }
  }

  private onThemeMutation = (): void => {
    this.readTheme(false);
  };

  private onResize = (): void => {
    const prevW = this.width;
    const prevH = this.height;
    this.syncSize();
    if (this.width === prevW && this.height === prevH) return;
    this.disposeTargets();
    this.setupTargets();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.reduced) return;

    const x = event.clientX * this.dpr;
    const y = event.clientY * this.dpr;
    this.mouse.velocityX = (x - this.mouse.x) * CONFIG.forceStrength;
    this.mouse.velocityY = (y - this.mouse.y) * CONFIG.forceStrength;
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.moved = true;
  };

  private onVisibility = (): void => {
    if (document.hidden) this.stopLoop();
    else this.startLoop();
  };

  private onMotionChange = (): void => {
    this.reduced = this.motionQuery.matches;
    if (this.reduced) this.mouse.moved = false;
  };

  private startLoop(): void {
    if (this.disposed || this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min((now - this.lastTime) / 1000, 0.016);
      this.lastTime = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private frame(dt: number): void {
    const follow = lerpFactor(dt, COLOR_FOLLOW);
    this.inkColor.lerp(this.inkTarget, follow);
    this.surfaceColor.lerp(this.surfaceTarget, follow);

    if (!this.reduced) {
      if (this.mouse.moved) {
        this.splat(
          this.mouse.x,
          this.mouse.y,
          this.mouse.velocityX,
          this.mouse.velocityY,
        );
        this.mouse.moved = false;
      }
      this.simulate(dt);
    }

    this.render();
    if (!this.painted) {
      this.painted = true;
      reportHomeCanvasReady();
    }
  }

  private setUniforms(
    material: THREE.ShaderMaterial,
    values: Record<
      string,
      THREE.Texture | THREE.Vector2 | THREE.Vector3 | number
    >,
  ): THREE.ShaderMaterial {
    for (const [key, val] of Object.entries(values)) {
      material.uniforms[key].value = val;
    }
    return material;
  }

  private pass(
    material: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget | null,
  ): void {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  private splat(
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
  ): void {
    const { splat } = this.materials;
    this.splatPoint.set(x / this.width, 1 - y / this.height);
    this.setUniforms(splat, {
      aspectRatio: this.width / this.height,
      radius: CONFIG.splatRadius / 100,
    });

    this.velocitySplat.set(velocityX, -velocityY, 0);
    this.setUniforms(splat, {
      uTarget: this.velocity.read.texture,
      color: this.velocitySplat,
    });
    this.pass(splat, this.velocity.write);
    this.velocity.swap();

    this.setUniforms(splat, {
      uTarget: this.dye.read.texture,
      color: this.dyeSplat,
    });
    this.pass(splat, this.dye.write);
    this.dye.swap();
  }

  private simulate(dt: number): void {
    const m = this.materials;
    const vel = this.velocity;
    const dye = this.dye;
    const pres = this.pressure;
    const simTexel = this.simTexel;

    this.pass(
      this.setUniforms(m.curl, {
        uVelocity: vel.read.texture,
        texelSize: simTexel,
      }),
      this.curlTarget,
    );
    this.pass(
      this.setUniforms(m.vorticity, {
        uVelocity: vel.read.texture,
        uCurl: this.curlTarget.texture,
        texelSize: simTexel,
        curlStrength: CONFIG.curl,
        dt,
      }),
      vel.write,
    );
    vel.swap();

    this.pass(
      this.setUniforms(m.divergence, {
        uVelocity: vel.read.texture,
        texelSize: simTexel,
      }),
      this.divergence,
    );
    this.pass(
      this.setUniforms(m.clear, {
        uTexture: pres.read.texture,
        value: CONFIG.pressureDecay,
      }),
      pres.write,
    );
    pres.swap();

    this.setUniforms(m.pressure, {
      uDivergence: this.divergence.texture,
      texelSize: simTexel,
    });
    for (let i = 0; i < CONFIG.pressureIterations; i++) {
      m.pressure.uniforms.uPressure.value = pres.read.texture;
      this.pass(m.pressure, pres.write);
      pres.swap();
    }

    this.pass(
      this.setUniforms(m.gradientSubtract, {
        uPressure: pres.read.texture,
        uVelocity: vel.read.texture,
        texelSize: simTexel,
      }),
      vel.write,
    );
    vel.swap();

    this.setUniforms(m.advection, {
      uVelocity: vel.read.texture,
      uSource: vel.read.texture,
      texelSize: simTexel,
      dt,
      dissipation: CONFIG.velocityDissipation,
    });
    this.pass(m.advection, vel.write);
    vel.swap();

    this.setUniforms(m.advection, {
      uVelocity: vel.read.texture,
      uSource: dye.read.texture,
      texelSize: this.dyeTexel,
      dissipation: CONFIG.dyeDissipation,
    });
    this.pass(m.advection, dye.write);
    dye.swap();
  }

  private render(): void {
    this.setUniforms(this.materials.display, {
      uTexture: this.dye.read.texture,
    });
    this.pass(this.materials.display, null);
  }
}
