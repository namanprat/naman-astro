/**
 * Live tuning for the ASCII field, one entry per surface.
 *
 * The three surfaces sit in five separate WebGL contexts (About, Team, and one
 * per Process card), so there is nowhere sensible to hang a shared React state.
 * This is a plain module store instead: `lil-gui` mutates the objects in place,
 * fields read them every frame, and only `density` — the one value that rebuilds
 * geometry — bothers to notify.
 */
export type AsciiSurface = "about" | "team" | "process";

export type AsciiTuning = {
  /** Glyph rows across the short axis. Columns follow from the aspect. */
  density: number;
  /** Glyph size inside its cell. Above 1 crops in, which reads denser. */
  glyphScale: number;
  /** Archive's polar re-radius exponent. 1 is off; below 1 fisheyes the grid. */
  warp: number;
  /** Brightness curve before the glyph lookup. Below 1 picks denser glyphs. */
  gamma: number;
  /** Per-cell brightness dither, so flat areas don't band. */
  jitter: number;
  /** Per-cell flicker, 0–1. Forced to 0 under reduced motion. */
  noise: number;
};

/** Look tuned on the Team cylinder; About follows the same lattice. */
const TEAM_LOOK: AsciiTuning = {
  density: 183,
  glyphScale: 2.2,
  warp: 1,
  gamma: 0.8,
  jitter: 0.02,
  noise: 0.6,
};

export const ASCII_DEFAULTS: Record<AsciiSurface, AsciiTuning> = {
  about: { ...TEAM_LOOK },
  team: { ...TEAM_LOOK },
  process: {
    density: 40,
    glyphScale: 1.2,
    warp: 1,
    gamma: 0.8,
    jitter: 0.02,
    noise: 0.25,
  },
};

export const ASCII_SURFACES = Object.keys(ASCII_DEFAULTS) as AsciiSurface[];

const STORAGE_KEY = "ascii-tuning-v2";

const tuning: Record<AsciiSurface, AsciiTuning> = {
  about: { ...ASCII_DEFAULTS.about },
  team: { ...ASCII_DEFAULTS.team },
  process: { ...ASCII_DEFAULTS.process },
};

const listeners = new Map<AsciiSurface, Set<() => void>>();

/** Only keys already on the default shape are restored — a stale blob can't
 *  smuggle in an unbounded density and hang the tab on 4M instances. */
function restore(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<
      Record<AsciiSurface, Partial<AsciiTuning>>
    >;
    for (const surface of ASCII_SURFACES) {
      const patch = saved[surface];
      if (!patch) continue;
      for (const key of Object.keys(
        ASCII_DEFAULTS[surface],
      ) as (keyof AsciiTuning)[]) {
        const value = patch[key];
        if (typeof value === "number" && Number.isFinite(value)) {
          tuning[surface][key] = value;
        }
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
export function getAsciiTuning(surface: AsciiSurface): AsciiTuning {
  return tuning[surface];
}

export function subscribeAsciiTuning(
  surface: AsciiSurface,
  listener: () => void,
): () => void {
  const set = listeners.get(surface) ?? new Set();
  listeners.set(surface, set);
  set.add(listener);
  return () => set.delete(listener);
}

/** Call after mutating a surface's tuning, so density rebuilds its grid. */
export function notifyAsciiTuning(surface: AsciiSurface): void {
  persist();
  listeners.get(surface)?.forEach((listener) => listener());
}

export function resetAsciiTuning(): void {
  for (const surface of ASCII_SURFACES) {
    Object.assign(tuning[surface], ASCII_DEFAULTS[surface]);
  }
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Nothing to clear. */
    }
  }
  for (const surface of ASCII_SURFACES) {
    listeners.get(surface)?.forEach((listener) => listener());
  }
}

export function serializeAsciiTuning(): string {
  return JSON.stringify(tuning, null, 2);
}
