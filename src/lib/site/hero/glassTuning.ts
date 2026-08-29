/**
 * Live tuning for the frosted-glass hero, in three groups: the transmission
 * material, the scene around it, and the wordmark melt underneath.
 *
 * ponytail: a plain module store, same shape as `ascii/asciiTuning.ts` — lil-gui
 * mutates the objects in place and the R3F components read them. Three groups
 * rather than one flat bag because `material` can be spread straight onto
 * `<MeshTransmissionMaterial>`, and a stray `modelScale` in that spread is a
 * React unknown-prop warning per frame.
 */
export type GlassMaterialTuning = {
  /** Refraction depth. The single biggest lever on how frosted it reads. */
  thickness: number;
  roughness: number;
  transmission: number;
  ior: number;
  chromaticAberration: number;
  /** Second render pass from inside the shell. Doubles the cost, halves the flatness. */
  backside: boolean;
  anisotropicBlur: number;
  distortion: number;
  distortionScale: number;
  temporalDistortion: number;
  /** Blur taps. The one knob that actually shows up in a frame profile. */
  samples: number;
  /** Transmission FBO edge, in px. Powers of two only. */
  resolution: number;
};

export type GlassSceneTuning = {
  /**
   * Longest-axis size of the fitted GLB, as a fraction of the visible width at
   * the model's depth — the `viewport.width / 3` idea from the reference
   * snippet. A fixed world size would fill a desktop and overrun a phone.
   */
  modelScale: number;
  /** Distance in front of the wordmark plane, in world units. */
  modelDepth: number;
  envIntensity: number;
  /** `OrbitControls.autoRotateSpeed` — duforn-old ran this at 1. */
  autoRotateSpeed: number;
  /** Radians of Y spin per pixel scrolled. duforn-old's `scrollY * 0.001`. */
  scrollSpin: number;
};

export type GlassMeltTuning = {
  /**
   * Blur px → mip LOD. A mip level box-filters 2^L texels, so the base is
   * `log2(2 * blurPx)`; this scales that to taste against the DOM melt.
   */
  lodScale: number;
  /**
   * Half-width of the alpha cut, standing in for the 0.4px softener that runs
   * after `feColorMatrix` in `GooeyFilter.astro`.
   */
  aa: number;
  /** Where the cut sits. 140/255 ≈ 0.549 is the SVG filter's own edge. */
  threshold: number;
};

/** The fluid-masked ASCII pass over the logo (`HeroAsciiReveal`). */
export type GlassRevealTuning = {
  /**
   * The glyph reveal's own cut, defaulting to the fluid display pass's
   * (`CONFIG.threshold` / `CONFIG.edgeSoftness`) so the characters land exactly
   * inside the trail. The streak itself always takes the sim's, not these.
   */
  maskThreshold: number;
  /** Width of that cut, centred on the threshold. 0 is a hard edge. */
  maskSoftness: number;
  /** Glyph coverage inside the trail. 1 is every cell the matte reaches. */
  glyphOpacity: number;
};

export type GlassTuning = {
  material: GlassMaterialTuning;
  scene: GlassSceneTuning;
  melt: GlassMeltTuning;
  reveal: GlassRevealTuning;
};

/** The brief's values, plus what the look needs around them. */
export const GLASS_DEFAULTS: GlassTuning = {
  material: {
    thickness: 0.2,
    roughness: 0,
    transmission: 1,
    ior: 1.2,
    chromaticAberration: 0.02,
    backside: true,
    anisotropicBlur: 0,
    distortion: 0,
    distortionScale: 0.3,
    temporalDistortion: 0,
    samples: 8,
    resolution: 1024,
  },
  scene: {
    modelScale: 0.8,
    modelDepth: 3,
    envIntensity: 1,
    autoRotateSpeed: 1,
    scrollSpin: 0.001,
  },
  melt: {
    lodScale: 1,
    aa: 0.06,
    threshold: 0.55,
  },
  reveal: {
    maskThreshold: 1,
    maskSoftness: 0,
    glyphOpacity: 1,
  },
};

/** Phones pay for the transmission FBO twice over; these replace the two knobs
 *  that dominate it. Applied on top of whatever the GUI holds, not stored. */
export const GLASS_MOBILE_MATERIAL: Partial<GlassMaterialTuning> = {
  samples: 2,
  resolution: 256,
  backside: false,
};

export type GlassGroup = keyof GlassTuning;

/* v2: `modelScale` moved 0.45 → 0.8, and a stored v1 blob would out-vote it. */
const STORAGE_KEY = "glass-tuning-v4";

function clone(source: GlassTuning): GlassTuning {
  return {
    material: { ...source.material },
    scene: { ...source.scene },
    melt: { ...source.melt },
    reveal: { ...source.reveal },
  };
}

const tuning: GlassTuning = clone(GLASS_DEFAULTS);

const listeners = new Set<() => void>();

/** Only keys already on the default shape are restored, and only at the type
 *  they were authored with — a stale blob cannot smuggle in a 16k FBO. */
function restore(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<Record<GlassGroup, unknown>>;
    for (const group of Object.keys(GLASS_DEFAULTS) as GlassGroup[]) {
      const patch = saved[group];
      if (!patch || typeof patch !== "object") continue;
      const defaults = GLASS_DEFAULTS[group] as Record<string, unknown>;
      const live = tuning[group] as Record<string, unknown>;
      for (const key of Object.keys(defaults)) {
        const value = (patch as Record<string, unknown>)[key];
        if (typeof value !== typeof defaults[key]) continue;
        if (typeof value === "number" && !Number.isFinite(value)) continue;
        live[key] = value;
      }
    }
  } catch {
    /* Unreadable blob — the defaults above already stand. */
  }
}

restore();

function persist(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tuning));
  } catch {
    /* Private mode or a full quota — tuning just won't survive the next nav. */
  }
}

/** The live object. Mutate it in place; do not copy and reassign. */
export function getGlassTuning(): GlassTuning {
  return tuning;
}

export function subscribeGlassTuning(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call after mutating, so the React side re-reads and re-renders. */
export function notifyGlassTuning(): void {
  persist();
  listeners.forEach((listener) => listener());
}

export function resetGlassTuning(): void {
  const fresh = clone(GLASS_DEFAULTS);
  Object.assign(tuning.material, fresh.material);
  Object.assign(tuning.scene, fresh.scene);
  Object.assign(tuning.melt, fresh.melt);
  Object.assign(tuning.reveal, fresh.reveal);
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Nothing to clear. */
    }
  }
  listeners.forEach((listener) => listener());
}

export function serializeGlassTuning(): string {
  return JSON.stringify(tuning, null, 2);
}
