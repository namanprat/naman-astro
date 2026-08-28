/**
 * Live tuning for the home hero glass logo — the duforn-old `newlogo.glb`
 * sculpture, re-shaded as frosted physical glass.
 *
 * lil-gui mutates this object in place; the canvas reads it every frame and
 * only `notifyHeroGlass` persists + wakes subscribers.
 */
export const HERO_SCENE_URL = "/models/hero-scene.glb";

export type HeroGlassControls = {
  color: string;
  transmission: number;
  roughness: number;
  thickness: number;
  ior: number;
  envMapIntensity: number;
  opacity: number;
  scale: number;
  rotateY: number;
  autoRotateSpeed: number;
};

export const HERO_GLASS_DEFAULTS: HeroGlassControls = {
  color: "#d8e2e8",
  transmission: 1,
  roughness: 0.35,
  thickness: 0.8,
  ior: 1.5,
  envMapIntensity: 1,
  opacity: 1,
  scale: 1,
  rotateY: 0,
  autoRotateSpeed: 1,
};

const STORAGE_KEY = "hero-glass-v1";

const controls: HeroGlassControls = { ...HERO_GLASS_DEFAULTS };
const listeners = new Set<() => void>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function restore(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<HeroGlassControls>;
    for (const key of Object.keys(
      HERO_GLASS_DEFAULTS,
    ) as (keyof HeroGlassControls)[]) {
      const value = saved[key];
      if (key === "color") {
        if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
          controls.color = value;
        }
        continue;
      }
      if (isFiniteNumber(value)) controls[key] = value;
    }
  } catch {
    /* Unreadable blob — defaults already stand. */
  }
}

restore();

function persist(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
  } catch {
    /* Private mode or a full quota — tuning just won't survive the next nav. */
  }
}

/** The live object. Mutate it in place; do not copy and reassign. */
export function getHeroGlass(): HeroGlassControls {
  return controls;
}

export function subscribeHeroGlass(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyHeroGlass(): void {
  persist();
  listeners.forEach((listener) => listener());
}

export function resetHeroGlass(): void {
  Object.assign(controls, HERO_GLASS_DEFAULTS);
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Nothing to clear. */
    }
  }
  listeners.forEach((listener) => listener());
}

export function serializeHeroGlass(): string {
  return JSON.stringify(controls, null, 2);
}

/** No usable WebGL — skip the island rather than throwing from R3F. */
export function canMountHeroGlass(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    return !!gl;
  } catch {
    return false;
  }
}
