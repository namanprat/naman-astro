/**
 * Live pose / lighting for the three Process-card GLBs.
 *
 * One object per card, mutated in place by `processModelGui` and read every
 * frame by `ProcessCardCanvas`. Same shape as `ascii/asciiTuning.ts`: there is
 * no React tree that owns all three canvases, so a module store is the place
 * the GUI and the fields can both see.
 */
export const PROCESS_CARD_IDS = ["1", "2", "3"] as const;
export type ProcessCardId = (typeof PROCESS_CARD_IDS)[number];

export const PROCESS_MODEL_URLS: Record<ProcessCardId, string> = {
  "1": "/models/1.glb",
  "2": "/models/2.glb",
  "3": "/models/3.glb",
};

/** Folder titles in the GUI — filenames stay `1.glb` / `2.glb` / `3.glb`. */
export const PROCESS_MODEL_LABELS: Record<ProcessCardId, string> = {
  "1": "1 · rock",
  "2": "2 · flower",
  "3": "3 · bolt",
};

export type ProcessModelTuning = {
  /** Longest-axis world size after the GLB is unit-normalized. */
  scale: number;
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  fov: number;
  camZ: number;
  ambient: number;
  directional: number;
  lightX: number;
  lightY: number;
  lightZ: number;
  roughness: number;
  metalness: number;
  /** Hard-edge look. Helps the rock read as facets in the glyph lattice. */
  flatShading: boolean;
  /** Radians per second of idle Y spin. 0 is scroll-only. */
  idleSpin: number;
  /** Radians of Y spin per pixel/s of scroll velocity. */
  scrollSpin: number;
};

/** The pose keys. Excluded from `SHARED` so every card has to state its own. */
type ProcessModelPose = Pick<
  ProcessModelTuning,
  "scale" | "posX" | "posY" | "posZ" | "rotX" | "rotY" | "rotZ"
>;

/** Camera, lights and material only. The three cards are framed identically;
 *  it is the models that have to be posed apart. */
const SHARED: Omit<ProcessModelTuning, keyof ProcessModelPose> = {
  fov: 35,
  camZ: 2.8,
  ambient: 0.08,
  directional: 2.5,
  lightX: 1,
  lightY: 0.4,
  lightZ: 0.9,
  roughness: 0.4,
  metalness: 0,
  flatShading: false,
  idleSpin: 0.22,
  scrollSpin: 0.000006,
};

/**
 * Pose is per model, spelled out rather than inherited.
 *
 * `prepareLitClone` normalizes each GLB to a unit longest axis, so one shared
 * pose frames three very different silhouettes very differently: the rock is
 * chunky in every direction, the flower is nearly all stem, the bolt is a flat
 * plate. Each also idles around Y, so a pose has to hold the whole sweep of
 * that spin inside the card — at `fov: 35` and `camZ: 2.8` the stage is roughly
 * 1.77 world units square, which is the budget these values spend.
 */
export const PROCESS_MODEL_DEFAULTS: Record<ProcessCardId, ProcessModelTuning> =
  {
    /* Rock: sized by `posZ` rather than `scale` — pulling it toward the camera
       fills the card and lets the perspective spread the near facets. Ambient
       is way up on this one alone: with the key light doing all the work the
       flat-shaded facets blew out to a hard light/dark split instead of the
       even glyph gradient the other two get. */
    "1": {
      ...SHARED,
      scale: 1,
      posX: 0,
      posY: 0.02,
      posZ: 0.66,
      rotX: 0.29,
      rotY: 0,
      rotZ: 0.1,
      ambient: 0.77,
      flatShading: true,
      idleSpin: 0.18,
    },
    /* Flower: nearly all stem, so framing the whole model leaves a bloom too
       small to read beside the rock. Scaled up and pushed down instead, which
       fills the card with the head and runs the stem off the bottom edge. The
       steep `rotX` opens the bloom toward camera — shallower, it flattens into
       a fan. */
    "2": {
      ...SHARED,
      scale: 1.56,
      posX: -0.03,
      posY: -0.3,
      posZ: 0.02,
      rotX: 0.71,
      rotY: 0,
      rotZ: 0,
      idleSpin: 0.12,
    },
    /* Bolt: kept face-on, because any forward tilt foreshortens the one axis
       that carries the silhouette. `rotZ` sets it on a diagonal so it reads as
       more than a vertical sliver, and the fastest idle spin of the three
       carries it through the edge-on phases quickly. */
    "3": {
      ...SHARED,
      scale: 1.57,
      posX: -0.02,
      posY: 0,
      posZ: -0.02,
      rotX: 0,
      rotY: 0,
      rotZ: 0.5,
      idleSpin: 0.32,
    },
  };

const STORAGE_KEY = "process-model-tuning-v1";

function cloneAll(): Record<ProcessCardId, ProcessModelTuning> {
  const next = {} as Record<ProcessCardId, ProcessModelTuning>;
  for (const id of PROCESS_CARD_IDS) {
    next[id] = { ...PROCESS_MODEL_DEFAULTS[id] };
  }
  return next;
}

const tuning: Record<ProcessCardId, ProcessModelTuning> = cloneAll();

const listeners = new Map<ProcessCardId, Set<() => void>>();

function restore(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<
      Record<ProcessCardId, Partial<ProcessModelTuning>>
    >;
    for (const id of PROCESS_CARD_IDS) {
      const patch = saved[id];
      if (!patch) continue;
      const defaults = PROCESS_MODEL_DEFAULTS[id];
      const live = tuning[id];
      for (const key of Object.keys(defaults) as (keyof ProcessModelTuning)[]) {
        const value = patch[key];
        if (typeof value !== typeof defaults[key]) continue;
        if (typeof value === "number" && !Number.isFinite(value)) continue;
        (live as Record<string, unknown>)[key] = value;
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
export function getProcessModelTuning(card: ProcessCardId): ProcessModelTuning {
  return tuning[card];
}

export function subscribeProcessModelTuning(
  card: ProcessCardId,
  listener: () => void,
): () => void {
  const set = listeners.get(card) ?? new Set();
  listeners.set(card, set);
  set.add(listener);
  return () => set.delete(listener);
}

export function notifyProcessModelTuning(card: ProcessCardId): void {
  persist();
  listeners.get(card)?.forEach((listener) => listener());
}

export function resetProcessModelTuning(): void {
  const fresh = cloneAll();
  for (const id of PROCESS_CARD_IDS) {
    Object.assign(tuning[id], fresh[id]);
  }
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Nothing to clear. */
    }
  }
  for (const id of PROCESS_CARD_IDS) {
    listeners.get(id)?.forEach((listener) => listener());
  }
}

export function serializeProcessModelTuning(): string {
  return JSON.stringify(tuning, null, 2);
}
