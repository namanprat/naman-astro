/**
 * lil-gui panel for the frosted-glass hero — `ascii/asciiGui.ts` against the
 * glass store.
 *
 * ponytail: opt-in and lazily imported, so a production page never downloads
 * lil-gui unless someone asks for it by hand. It mounts on `astro dev` above
 * phone width, or anywhere the URL carries `?glass-gui`. Values live in
 * sessionStorage, so they survive the hard navigations `pageTransition.ts` does.
 */
import type GUI from "lil-gui";
import { MOBILE_LAYOUT_MQ } from "../isMobileLayout";
import {
  GLASS_DEFAULTS,
  getGlassTuning,
  notifyGlassTuning,
  resetGlassTuning,
  serializeGlassTuning,
  type GlassGroup,
} from "./glassTuning";

/** `[min, max, step]` per numeric key. A key absent here is a boolean. */
const RANGES: Record<GlassGroup, Record<string, [number, number, number]>> = {
  material: {
    thickness: [0, 3, 0.05],
    roughness: [0, 1, 0.01],
    transmission: [0, 1, 0.01],
    ior: [1, 3, 0.01],
    chromaticAberration: [0, 1, 0.01],
    anisotropicBlur: [0, 2, 0.01],
    distortion: [0, 1, 0.01],
    distortionScale: [0, 1, 0.01],
    temporalDistortion: [0, 1, 0.01],
    samples: [1, 16, 1],
    resolution: [128, 2048, 128],
  },
  scene: {
    modelScale: [0.05, 1.5, 0.01],
    modelDepth: [0, 4.5, 0.05],
    envIntensity: [0, 4, 0.05],
    autoRotateSpeed: [0, 8, 0.1],
    scrollSpin: [0, 0.01, 0.0001],
  },
  melt: {
    lodScale: [0.1, 3, 0.01],
    aa: [0, 3, 0.05],
    threshold: [0.05, 0.95, 0.005],
  },
  /* The glyph reveal. The trail itself takes its edge from the sim, so that it
     cannot drift from the one on the rest of the page; these tighten the glyphs
     within it. Their own look — density, glyph scale, gamma, jitter, flicker —
     is the `hero` folder of the ASCII panel, which owns that lattice for every
     surface on the site. */
  reveal: {
    maskThreshold: [0, 3, 0.01],
    maskSoftness: [0, 3, 0.01],
    glyphOpacity: [0, 1, 0.01],
  },
};

function guiEnabled(): boolean {
  if (typeof window === "undefined") return false;
  // Asked for by hand: honour it at any width, including production.
  if (new URLSearchParams(window.location.search).has("glass-gui")) return true;
  // Phone width has no room for the panel beside the nav. `astro dev` alone is
  // not enough there.
  if (window.matchMedia(MOBILE_LAYOUT_MQ).matches) return false;
  return import.meta.env.DEV;
}

let guiPromise: Promise<GUI | null> | null = null;

async function getGui(): Promise<GUI | null> {
  guiPromise ??= import("lil-gui")
    .then(({ default: Gui }) => {
      const gui = new Gui({ title: "Glass" });
      gui.domElement.style.zIndex = "2147483647";
      // Bottom-right, one panel-width in from the corner: the ASCII panel parks
      // in the corner itself and the two would otherwise stack on each other.
      gui.domElement.style.top = "auto";
      gui.domElement.style.bottom = "0";
      gui.domElement.style.right = "17rem";
      gui.close();
      gui.add({ reset: () => resetGlassTuning() }, "reset").name("Reset all");
      gui
        .add(
          {
            copy: () => {
              const json = serializeGlassTuning();
              void navigator.clipboard?.writeText(json).catch(() => {});
              console.info("[glass] tuning\n" + json);
            },
          },
          "copy",
        )
        .name("Copy values");
      return gui;
    })
    .catch(() => null);
  return guiPromise;
}

let mounted = false;

/** Build the three folders. Idempotent — the canvas may remount on a theme or
 *  breakpoint change and only the first call builds anything. */
export async function ensureGlassGui(): Promise<void> {
  if (!guiEnabled() || mounted) return;
  mounted = true;

  const gui = await getGui();
  if (!gui) {
    mounted = false;
    return;
  }

  const tuning = getGlassTuning();
  for (const group of Object.keys(GLASS_DEFAULTS) as GlassGroup[]) {
    const folder = gui.addFolder(group);
    const live = tuning[group] as Record<string, number | boolean>;
    for (const key of Object.keys(GLASS_DEFAULTS[group])) {
      const range = RANGES[group][key];
      const controller = range
        ? folder.add(live, key, range[0], range[1], range[2])
        : folder.add(live, key);
      controller.listen().onChange(() => notifyGlassTuning());
    }
  }
  // Material first: it is what anyone opening this panel came for.
  gui.folders[0]?.open();
}
