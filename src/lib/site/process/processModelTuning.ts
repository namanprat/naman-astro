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

const SHARED: ProcessModelTuning = {
  scale: 1.55,
  posX: 0,
  posY: 0,
  posZ: 0,
  rotX: 0.35,
  rotY: 0,
  rotZ: 0.1,
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

export const PROCESS_MODEL_DEFAULTS: Record<ProcessCardId, ProcessModelTuning> =
  {
    "1": { ...SHARED, scale: 1.5, flatShading: true, idleSpin: 0.18 },
    "2": { ...SHARED, scale: 1.7, rotX: 0.12, rotZ: 0.04, idleSpin: 0.12 },
    "3": { ...SHARED, scale: 1.85, rotX: 0.2, rotZ: 0.16, idleSpin: 0.32 },
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
