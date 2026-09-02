/**
 * GPU stable-fluids backdrop. Port of `codegrid-cappen-fluid-simulation`
 * (config, splat, advection, display invert) onto R3F's renderer so the hero
 * glass can refract it. Cappen used mix-blend-mode: difference on its own
 * canvas; that blend would invert the logo too, so the invert is in the
 * display pass against `--background` instead.
 *
 * `FluidCanvas` calls `update()` from `useFrame`. The display pass lands in
 * `output`, hung on `scene.background`.
 */
import * as THREE from "three";
import { readCssColor, shaderColor } from "../cssColor";
import { MOBILE_LAYOUT_MQ } from "../isMobileLayout";
import { TOUCH_PRIMARY_MQ } from "../isTouchPrimary";
import { prefersReducedMotion } from "../prefersReducedMotion";
import { reportHomeCanvasReady } from "../preloadAssets";
import { SWATCH_DARK, SWATCH_TRAIL } from "../siteColors";
import { pace, SETTLE_AFTER_MS } from "./fluidPacing";
import shaders from "./shaders";

const COLOR_FOLLOW = 6;
/** ~0.45s to settle, matching the CSS opacity transition it replaces. */
const MIX_FOLLOW = 8;

/* Full strength the whole way down. The manifesto/team dim that used to ride on
   `is-hero-fluid-dim` is gone by request — the trail holds one weight now. */
const BASE_MIX = 1;
const PRELOAD_MIX = 1;

/** Numbers from codegrid-cappen-fluid-simulation/js/script.js. */
const CONFIG = {
  curl: 50,
  velocityDissipation: 0.95,
  dyeDissipation: 0.95,
  splatRadius: 0.3,
  forceStrength: 8.5,
  pressureDecay: 0.75,
  threshold: 1.0,
  edgeSoftness: 0.0,
} as const;

/**
 * Grid sizes and solver depth, per layout / input.
 *
 * The desktop numbers are Cappen's. The phone tier is the same effect at a
 * budget a phone or tablet can hold. A 1024-wide dye buffer is ~18MB of
 * half-float per ping-pong side at phone aspect, and the pressure solve alone
 * is 40 of the 47 full-screen passes a simulated frame costs.
 *
 * ponytail: phone quality also applies on touch-primary tablets above the
 * layout breakpoint — an iPad is desktop width with a finger, and the
 * interactive trail is off there anyway (seed bloom only).
 */
const QUALITY = {
  desktop: { simResolution: 256, dyeResolution: 1024, pressureIterations: 40 },
  phone: { simResolution: 128, dyeResolution: 512, pressureIterations: 12 },
} as const;

type Quality = (typeof QUALITY)[keyof typeof QUALITY];

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
    /* Clip-space quad. R3F leaves cull/depth on from the hero mesh; FrontSide
       would drop every fragment and the plate would stay the clear colour. */
    side: THREE.DoubleSide,
    /* MTM / Environment leave blend funcs dirty. Default NormalBlending onto
       an uncleared target turns every sim pass into a smear. */
    blending: THREE.NoBlending,
    toneMapped: false,
    fog: false,
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
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly materials: Materials;
  private readonly abort = new AbortController();
  private readonly motionQuery: MediaQueryList;
  private readonly layoutQuery: MediaQueryList;
  private readonly touchQuery: MediaQueryList;

  private readonly pageColor = shaderColor(SWATCH_DARK);
  private readonly pageTarget = shaderColor(SWATCH_DARK);
  /** `--trail`: grey on the dark theme, brand black on the light one. */
  private readonly trailColor = shaderColor(SWATCH_TRAIL);
  private readonly trailTarget = shaderColor(SWATCH_TRAIL);

  private readonly splatPoint = new THREE.Vector2();
  private readonly velocitySplat = new THREE.Vector3();
  private readonly dyeSplat = new THREE.Vector3(3, 3, 3);
  private readonly simTexel = new THREE.Vector2();
  private readonly dyeTexel = new THREE.Vector2();

  /** The composited backdrop. `FluidCanvas` hangs this on `scene.background`. */
  output!: THREE.WebGLRenderTarget;
  /** Written this frame; swapped into `output` after the display pass so the
   *  scene never samples a texture that is also the current framebuffer. */
  private outputWrite!: THREE.WebGLRenderTarget;

  private velocity!: PingPong;
  private dye!: PingPong;
  private divergence!: THREE.WebGLRenderTarget;
  private curlTarget!: THREE.WebGLRenderTarget;
  private pressure!: PingPong;
  private simSize: Size = { w: 1, h: 1 };
  private dyeSize: Size = { w: 1, h: 1 };
  private quality: Quality = QUALITY.desktop;

  private width = 1;
  private height = 1;
  private readonly measured = new THREE.Vector2();

  private mouse = { x: 0, y: 0, velocityX: 0, velocityY: 0, moved: false };
  private pointerPrimed = false;
  private reduced = prefersReducedMotion();
  private painted = false;
  private disposed = false;
  /** Elapsed time not yet simulated — see `update`. */
  private pending = 0;
  private seedPending = false;
  /** How much of the sim is let through over the page fill, and where it is
   *  heading. Was `.fluid_wrap canvas`'s CSS `opacity` and its 0.45s ease. */
  private pageMix = BASE_MIX;
  private pageMixTarget = BASE_MIX;
  private lastTheme = { page: "", trail: "" };
  /** Last user pointer activity — ambient preload splats pause while the
   *  visitor is painting trails themselves. */
  private lastPointerAt = 0;
  private ambientPhase = 0;
  /** While `now` is under this, the picture is still changing. See `wake`. */
  private activeUntil = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.materials = this.makeMaterials();
    this.syncSize();
    this.layoutQuery = window.matchMedia(MOBILE_LAYOUT_MQ);
    this.touchQuery = window.matchMedia(TOUCH_PRIMARY_MQ);
    this.quality = this.resolveQuality();
    this.setupTargets();
    this.readTheme(true);
    this.readMix();
    this.pageMix = this.pageMixTarget;

    const { signal } = this.abort;
    /* No resize listener: `update` watches the renderer's own size, which R3F
       keeps on the container rather than on the window. */
    window.addEventListener("pointermove", this.onPointerMove, {
      passive: true,
      signal,
    });

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.motionQuery.addEventListener("change", this.onMotionChange, {
      signal,
    });

    this.layoutQuery.addEventListener("change", this.onQualityChange, {
      signal,
    });
    this.touchQuery.addEventListener("change", this.onQualityChange, {
      signal,
    });

    /* Class only. Theme is class state, but the filter used to include
       `style` — and `Menu` writes custom properties on `<html>`, so every one
       of those woke this callback into two `getComputedStyle` reads. On a
       scroll frame that was a forced style recalc per frame for nothing.
       About-open must not park this loop: the panel frost samples the sim. */
    const observer = new MutationObserver(this.onThemeMutation);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    signal.addEventListener("abort", () => observer.disconnect());

    // Opening bloom so the first preloader frame isn't a flat dark plane. Held
    // for the first `update` rather than a rAF of its own: a splat leaves its
    // ping-pong target bound, and outside the frame R3F would render the page
    // into it.
    this.seedPending =
      !this.reduced &&
      document.documentElement.classList.contains("is-preloading");

    // The first frames always run: `render` is what reports the canvas ready
    // and releases the preloader's `canvas` segment.
    this.wake();
  }

  /**
   * Something changed the picture — keep stepping for the dye's visible tail.
   *
   * Every entry point that can alter what `output` should hold goes through
   * here: a splat, a resize, a theme or mix change, a quality change. `update`
   * does nothing at all once this expires, so anything that forgets to call it
   * shows up as a backdrop frozen on the previous frame.
   */
  private wake(): void {
    this.activeUntil = performance.now() + SETTLE_AFTER_MS;
  }

  /** Raw dye, before the display pass turns it into the page's liquid trail. */
  get dyeTexture(): THREE.Texture {
    return this.dye.read.texture;
  }

  /** Lets consumers skip their mask pass once the visitor's trail has settled. */
  get dyeActive(): boolean {
    return (
      !this.reduced &&
      (this.mouse.moved ||
        performance.now() - this.lastPointerAt < SETTLE_AFTER_MS)
    );
  }

  get dyeThreshold(): number {
    return CONFIG.threshold;
  }

  /** With the threshold, the whole edge the display pass cuts the trail on.
   *  Anything else drawing the same liquid has to use both or it reads as a
   *  different shape — the hero streak did, feathered where this is crisp. */
  get dyeEdgeSoftness(): number {
    return CONFIG.edgeSoftness;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.disposeTargets();
    this.quad.geometry.dispose();
    for (const material of Object.values(this.materials)) {
      material.dispose();
    }
    // The renderer belongs to R3F; it tears down its own context.
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
        pageColor: { value: this.pageColor },
        trailColor: { value: this.trailColor },
        pageMix: num(BASE_MIX),
      }),
    };
  }

  /**
   * CSS pixels, not device pixels. The display pass covers the whole viewport,
   * so DPR 2 would quadruple its fill rate for a soft two-colour gradient with
   * nothing in it to resolve — and the canvas itself now runs at the hero
   * glass's DPR, which the sim has no reason to pay for.
   */
  private syncSize(): void {
    const size = this.renderer.getSize(this.measured);
    this.width = Math.max(1, Math.round(size.x));
    this.height = Math.max(1, Math.round(size.y));
  }

  private setupSimTargets(): void {
    const aspect = this.width / this.height;
    const { simResolution, dyeResolution } = this.quality;
    this.simSize = {
      w: simResolution,
      h: Math.max(1, Math.round(simResolution / aspect)),
    };
    this.dyeSize = {
      w: dyeResolution,
      h: Math.max(1, Math.round(dyeResolution / aspect)),
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

  private setupTargets(): void {
    this.setupSimTargets();
    /* Linear, and half-float so the shadows this plate is almost entirely made
       of do not band in 8 bits. The display pass converts on the way in (see
       `shaders.ts`); three's background draw converts back on the way out. */
    this.output = new THREE.WebGLRenderTarget(this.width, this.height, {
      ...TARGET_OPTIONS,
    });
    this.outputWrite = new THREE.WebGLRenderTarget(this.width, this.height, {
      ...TARGET_OPTIONS,
    });
  }

  private disposeSimTargets(): void {
    disposePingPong(this.velocity);
    disposePingPong(this.dye);
    disposePingPong(this.pressure);
    this.divergence.dispose();
    this.curlTarget.dispose();
  }

  private disposeTargets(): void {
    this.disposeSimTargets();
    this.output.dispose();
    this.outputWrite.dispose();
  }

  private readTheme(snap: boolean): void {
    const next = {
      page: readCssColor("--background", SWATCH_DARK),
      trail: readCssColor("--trail", SWATCH_TRAIL),
    };
    if (next.page === this.lastTheme.page && next.trail === this.lastTheme.trail) {
      return;
    }
    this.lastTheme = next;
    this.pageTarget.copy(shaderColor(next.page));
    this.trailTarget.copy(shaderColor(next.trail));
    if (snap) {
      this.pageColor.copy(this.pageTarget);
      this.trailColor.copy(this.trailTarget);
    }
  }

  /** Full strength, and fuller still behind the preloader. Read off the same
   *  class mutation the theme rides on. */
  private readMix(): void {
    this.pageMixTarget = document.documentElement.classList.contains(
      "is-preloading",
    )
      ? PRELOAD_MIX
      : BASE_MIX;
  }

  private onThemeMutation = (): void => {
    this.readTheme(true);
    this.readMix();
    this.wake();
  };

  private resize(): void {
    const prevW = this.width;
    const prevH = this.height;
    this.syncSize();
    if (this.width === prevW && this.height === prevH) return;
    this.disposeSimTargets();
    this.setupSimTargets();
    /* Keep the same texture objects — `scene.background` is `output`, and
       disposing it leaves the scene pointing at a dead target. */
    this.output.setSize(this.width, this.height);
    this.outputWrite.setSize(this.width, this.height);
    this.wake();
  }

  private resolveQuality(): Quality {
    return this.layoutQuery.matches || this.touchQuery.matches
      ? QUALITY.phone
      : QUALITY.desktop;
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (this.reduced) return;
    /* ponytail: trail is mouse-only. Touch keeps the opening seed bloom and
       then parks — driving the sim from every scroll `pointermove` was what
       made phones and iPads lag, and skipping input used to blank the plate
       only because there was no seed. Seed still runs; interactive dye does
       not. */
    if (this.touchQuery.matches || event.pointerType === "touch") return;
    const x = event.clientX;
    const y = event.clientY;
    /* Same as Cappen's onMove, minus the first event: that one would splat
       with velocity from (0, 0) and flood the plate. */
    if (!this.pointerPrimed) {
      this.pointerPrimed = true;
      this.mouse.x = x;
      this.mouse.y = y;
      return;
    }
    this.mouse.velocityX = (x - this.mouse.x) * CONFIG.forceStrength;
    this.mouse.velocityY = (y - this.mouse.y) * CONFIG.forceStrength;
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.moved = true;
    this.lastPointerAt = performance.now();
    /* The move is what makes the next frame differ, so it has to re-arm the
       window itself. `splat` wakes too, but only from inside `frame`, which a
       parked loop never reaches — leaving the pointer unable to restart the
       sim it just gave work to. Tabbing away is the reliable way to see it:
       the park lands while the loop is stopped, and the trail stays frozen on
       return no matter how far the pointer moves. */
    this.wake();
  };

  private onMotionChange = (): void => {
    this.reduced = this.motionQuery.matches;
    if (this.reduced) this.mouse.moved = false;
    this.wake();
  };

  private onQualityChange = (): void => {
    const next = this.resolveQuality();
    if (next === this.quality) return;
    this.quality = next;
    /* Grid sizes are baked into the targets, so a tier change is a rebuild.
       The dye in flight goes with them — crossing the breakpoint is a resize,
       which already drops it. */
    this.disposeSimTargets();
    this.setupSimTargets();
    this.wake();
  };

  /**
   * One step, driven by R3F's loop. Skipping a step leaves `output` holding the
   * last frame, which is what the scene keeps sampling — the same thing the
   * canvas used to do when a rAF tick was skipped.
   */
  update(delta: number): void {
    if (this.disposed) return;
    this.resize();
    this.pending += delta;

    const step = pace({
      now: performance.now(),
      activeUntil: this.activeUntil,
      lastPointerAt: this.lastPointerAt,
      pending: this.pending,
    });

    switch (step.kind) {
      case "park":
        this.pending = 0;
        return;
      case "hold":
        return;
      case "step":
        this.pending = 0;
        this.frame(step.dt);
        return;
      default: {
        const unhandled: never = step;
        throw new Error(`unhandled fluid pacing: ${String(unhandled)}`);
      }
    }
  }

  private frame(dt: number): void {
    if (this.seedPending) {
      this.seedPending = false;
      this.seedOpeningSplats();
    }
    const follow = lerpFactor(dt, COLOR_FOLLOW);
    this.pageColor.lerp(this.pageTarget, follow);
    this.trailColor.lerp(this.trailTarget, follow);
    this.pageMix +=
      (this.pageMixTarget - this.pageMix) * lerpFactor(dt, MIX_FOLLOW);

    if (!this.reduced) {
      if (this.mouse.moved) {
        this.splat(
          this.mouse.x,
          this.mouse.y,
          this.mouse.velocityX,
          this.mouse.velocityY,
        );
        this.mouse.moved = false;
      } else if (
        document.documentElement.classList.contains("is-preloading") &&
        performance.now() - this.lastPointerAt > 240
      ) {
        this.ambientPreloadSplat(dt);
      }
      this.simulate(dt);
    }

    this.render();
    if (!this.painted) {
      this.painted = true;
      reportHomeCanvasReady();
    }
  }

  /** A few radial bursts so dye exists before the first pointermove. */
  private seedOpeningSplats(): void {
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const r = Math.min(this.width, this.height) * 0.18;
    const force = CONFIG.forceStrength * 12;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.splat(
        cx + Math.cos(angle) * r,
        cy + Math.sin(angle) * r,
        Math.cos(angle) * force,
        Math.sin(angle) * force,
      );
    }
  }

  /** Slow orbit while the preloader is up and the pointer is idle. */
  private ambientPreloadSplat(dt: number): void {
    this.ambientPhase += dt * 1.35;
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const rx = this.width * 0.2;
    const ry = this.height * 0.16;
    const x = cx + Math.cos(this.ambientPhase) * rx;
    const y = cy + Math.sin(this.ambientPhase * 1.25) * ry;
    const speed = CONFIG.forceStrength * 0.35;
    this.splat(
      x,
      y,
      -Math.sin(this.ambientPhase) * rx * speed,
      Math.cos(this.ambientPhase * 1.25) * ry * speed,
    );
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
    const { renderer } = this;
    const prevAutoClear = renderer.autoClear;
    const prevScissorTest = renderer.getScissorTest();
    /* These targets have no depth; a default clear writes DEPTH_BUFFER_BIT and
       WebGL aborts the whole clear. The quad covers every pixel anyway. */
    renderer.autoClear = false;
    renderer.setScissorTest(false);
    this.quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = prevAutoClear;
    renderer.setScissorTest(prevScissorTest);
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

    this.wake();

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
    for (let i = 0; i < this.quality.pressureIterations; i++) {
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
      pageMix: this.pageMix,
    });
    this.pass(this.materials.display, this.outputWrite);
    const displayed = this.output;
    this.output = this.outputWrite;
    this.outputWrite = displayed;
    // R3F renders the scene straight after this; leaving its target bound here
    // would send the whole page into the backdrop's own buffer.
    this.renderer.setRenderTarget(null);
  }
}
