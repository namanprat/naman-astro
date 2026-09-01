/**
 * lil-gui panel for the three Process-card models — `ascii/asciiGui.ts`
 * against the per-card pose store.
 *
 * ponytail: opt-in and lazily imported, so a production page never downloads
 * lil-gui unless someone asks for it by hand. It mounts on `astro dev` above
 * phone width, or anywhere the URL carries `?process-gui`. Values live in
 * sessionStorage, so they survive the hard navigations `pageTransition.ts` does.
 */
import type GUI from "lil-gui";
import { MOBILE_LAYOUT_MQ } from "../isMobileLayout";
import {
  PROCESS_CARD_IDS,
  PROCESS_MODEL_DEFAULTS,
  PROCESS_MODEL_LABELS,
  getProcessModelTuning,
  notifyProcessModelTuning,
  resetProcessModelTuning,
  serializeProcessModelTuning,
  type ProcessCardId,
  type ProcessModelTuning,
} from "./processModelTuning";

/** `[min, max, step]` per numeric key. A key absent here is a boolean. */
const RANGES: Record<
  Exclude<keyof ProcessModelTuning, "flatShading">,
  [number, number, number]
> = {
  scale: [0.2, 4, 0.01],
  posX: [-2, 2, 0.01],
  posY: [-2, 2, 0.01],
  posZ: [-2, 2, 0.01],
  rotX: [-Math.PI, Math.PI, 0.01],
  rotY: [-Math.PI, Math.PI, 0.01],
  rotZ: [-Math.PI, Math.PI, 0.01],
  fov: [15, 90, 1],
  camZ: [1, 8, 0.05],
  ambient: [0, 2, 0.01],
  directional: [0, 8, 0.05],
  lightX: [-3, 3, 0.01],
  lightY: [-3, 3, 0.01],
  lightZ: [-3, 3, 0.01],
  roughness: [0, 1, 0.01],
  metalness: [0, 1, 0.01],
  idleSpin: [0, 2, 0.01],
  scrollSpin: [0, 0.00005, 0.000001],
};

function guiEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("process-gui"))
    return true;
  if (window.matchMedia(MOBILE_LAYOUT_MQ).matches) return false;
  return import.meta.env.DEV;
}

let guiPromise: Promise<GUI | null> | null = null;

async function getGui(): Promise<GUI | null> {
  guiPromise ??= import("lil-gui")
    .then(({ default: Gui }) => {
      const gui = new Gui({ title: "Process models" });
      gui.domElement.style.zIndex = "2147483647";
      // Bottom-left: ASCII parks bottom-right and Glass sits one panel in from
      // that corner, so this one takes the opposite edge of the process cards.
      gui.domElement.style.top = "auto";
      gui.domElement.style.bottom = "0";
      gui.domElement.style.right = "auto";
      gui.domElement.style.left = "0";
      gui.close();
      gui
        .add({ reset: () => resetProcessModelTuning() }, "reset")
        .name("Reset all");
      gui
        .add(
          {
            copy: () => {
              const json = serializeProcessModelTuning();
              void navigator.clipboard?.writeText(json).catch(() => {});
              console.info("[process] model tuning\n" + json);
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

/** Build the three card folders. Idempotent — each canvas calls this on mount
 *  and only the first one builds anything. */
export async function ensureProcessModelGui(): Promise<void> {
  if (!guiEnabled() || mounted) return;
  mounted = true;

  const gui = await getGui();
  if (!gui) {
    mounted = false;
    return;
  }

  for (const id of PROCESS_CARD_IDS) {
    addCardFolder(gui, id);
  }
  gui.folders[0]?.open();
}

function addCardFolder(gui: GUI, id: ProcessCardId): void {
  const live = getProcessModelTuning(id);
  const folder = gui.addFolder(PROCESS_MODEL_LABELS[id]);
  const defaults = PROCESS_MODEL_DEFAULTS[id];
  for (const key of Object.keys(defaults) as (keyof ProcessModelTuning)[]) {
    const range = key === "flatShading" ? undefined : RANGES[key];
    const controller = range
      ? folder.add(live, key, range[0], range[1], range[2])
      : folder.add(live, key);
    controller.listen().onChange(() => notifyProcessModelTuning(id));
  }
}
