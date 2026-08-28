/**
 * lil-gui panel for the hero glass logo. Same opt-in shape as `asciiGui.ts`:
 * `astro dev` above phone width, or `?glass-gui` anywhere.
 */
import type GUI from "lil-gui";
import { MOBILE_LAYOUT_MQ } from "./isMobileLayout";
import {
  getHeroGlass,
  notifyHeroGlass,
  resetHeroGlass,
  serializeHeroGlass,
  type HeroGlassControls,
} from "./heroGlass";

const RANGES: {
  [K in Exclude<keyof HeroGlassControls, "color">]: [number, number, number];
} = {
  transmission: [0, 1, 0.01],
  roughness: [0, 1, 0.01],
  thickness: [0, 3, 0.01],
  ior: [1, 2.333, 0.01],
  envMapIntensity: [0, 4, 0.05],
  opacity: [0, 1, 0.01],
  scale: [0.2, 3, 0.01],
  rotateY: [-180, 180, 1],
  autoRotateSpeed: [0, 4, 0.05],
};

function guiEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("glass-gui")) return true;
  if (window.matchMedia(MOBILE_LAYOUT_MQ).matches) return false;
  return import.meta.env.DEV;
}

let guiPromise: Promise<GUI | null> | null = null;
let mounted = false;

async function getGui(): Promise<GUI | null> {
  guiPromise ??= import("lil-gui")
    .then(({ default: Gui }) => {
      const gui = new Gui({ title: "Glass" });
      gui.domElement.style.zIndex = "2147483647";
      gui.domElement.style.top = "auto";
      gui.domElement.style.bottom = "0";
      gui.domElement.style.right = "0";
      gui.close();
      return gui;
    })
    .catch(() => null);
  return guiPromise;
}

export async function ensureHeroGlassGui(): Promise<void> {
  if (!guiEnabled() || mounted) return;
  mounted = true;

  const gui = await getGui();
  if (!gui) {
    mounted = false;
    return;
  }

  const tuning = getHeroGlass();
  gui.addColor(tuning, "color").listen().onChange(() => notifyHeroGlass());
  for (const key of Object.keys(RANGES) as (keyof typeof RANGES)[]) {
    const [min, max, step] = RANGES[key];
    gui
      .add(tuning, key, min, max, step)
      .listen()
      .onChange(() => notifyHeroGlass());
  }
  gui.add({ reset: () => resetHeroGlass() }, "reset").name("Reset defaults");
  gui
    .add(
      {
        copy: () => {
          const json = serializeHeroGlass();
          void navigator.clipboard?.writeText(json).catch(() => {});
          console.info("[glass] tuning\n" + json);
        },
      },
      "copy",
    )
    .name("Copy values");
}
