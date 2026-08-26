/**
 * lil-gui panel for the ASCII field — the Archive's `setUpSettings`, rebuilt
 * against the shared tuning store.
 *
 * ponytail: opt-in, and lazily imported. It mounts on `astro dev` above phone
 * width, or anywhere the URL carries `?ascii-gui`, so a production page never
 * downloads lil-gui unless someone asks for it by hand. Values live in
 * sessionStorage, so they survive the hard navigations `pageTransition.ts` does
 * between routes.
 */
import type GUI from "lil-gui";
import { MOBILE_LAYOUT_MQ } from "../isMobileLayout";
import {
  ASCII_DEFAULTS,
  getAsciiTuning,
  notifyAsciiTuning,
  resetAsciiTuning,
  serializeAsciiTuning,
  type AsciiSurface,
} from "./asciiTuning";

const RANGES: Record<
  keyof (typeof ASCII_DEFAULTS)["about"],
  [number, number, number]
> = {
  density: [8, 200, 1],
  glyphScale: [0.4, 3, 0.01],
  warp: [0.6, 1.4, 0.01],
  gamma: [0.2, 3, 0.01],
  jitter: [0, 0.4, 0.001],
  noise: [0, 1, 0.01],
};

function guiEnabled(): boolean {
  if (typeof window === "undefined") return false;
  // Asked for by hand: honour it at any width, including production.
  if (new URLSearchParams(window.location.search).has("ascii-gui")) return true;
  // Phone width has no room for the panel beside the nav — even collapsed it
  // lands on the four links in row 2. `astro dev` alone is not enough there.
  if (window.matchMedia(MOBILE_LAYOUT_MQ).matches) return false;
  return import.meta.env.DEV;
}

let guiPromise: Promise<GUI | null> | null = null;
const mounted = new Set<AsciiSurface>();

async function getGui(): Promise<GUI | null> {
  guiPromise ??= import("lil-gui")
    .then(({ default: Gui }) => {
      const gui = new Gui({ title: "ASCII" });
      gui.domElement.style.zIndex = "2147483647";
      // Bottom-right and collapsed: lil-gui's own corner is the nav's last
      // column, so an open panel sits on the Archive link and the theme toggle.
      gui.domElement.style.top = "auto";
      gui.domElement.style.bottom = "0";
      gui.domElement.style.right = "0";
      gui.close();
      gui.add({ reset: () => resetAsciiTuning() }, "reset").name("Reset all");
      gui
        .add(
          {
            copy: () => {
              const json = serializeAsciiTuning();
              void navigator.clipboard?.writeText(json).catch(() => {});
              console.info("[ascii] tuning\n" + json);
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

/**
 * Register a surface's folder. Idempotent — the three Process cards each call
 * this on mount and only the first one builds anything.
 */
export async function ensureAsciiGui(surface: AsciiSurface): Promise<void> {
  if (!guiEnabled() || mounted.has(surface)) return;
  mounted.add(surface);

  const gui = await getGui();
  if (!gui) {
    mounted.delete(surface);
    return;
  }

  const tuning = getAsciiTuning(surface);
  const folder = gui.addFolder(surface);
  for (const key of Object.keys(RANGES) as (keyof typeof RANGES)[]) {
    const [min, max, step] = RANGES[key];
    folder
      .add(tuning, key, min, max, step)
      .listen()
      .onChange(() => notifyAsciiTuning(surface));
  }
}
