/**
 * Load a GLB once per URL, and keep the result.
 *
 * Replaces drei's `useGLTF` — both the hook and its `preload`/`setDecoderPath`
 * statics. There are five GLBs on this site and three of them are wanted before
 * the component that draws them exists, which is why the cache is a module Map
 * keyed by URL rather than anything scoped to a mount.
 *
 * ponytail: the cache stores the *promise*, not the result. Two Process cards
 * scrolling into view in the same frame both call `loadGLTF` before either
 * resolves; keyed on the result they would each start a fetch and decode the
 * same Draco payload twice.
 *
 * ponytail: callers get a `clone()` of the loaded scene, never the cached one.
 * Three Process cards share `1.glb`..`3.glb` between them and each mutates its
 * own copy — materials swapped for one shared white standard material, transform
 * driven per card by its tuning store. Handing out the cached scene would make
 * the last card to mount win for all of them.
 */
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Object3D } from "three/webgpu";

/** Matches the decoder shipped in `public/draco/gltf/`. */
export const DRACO_PATH = "/draco/gltf/";

let loader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (loader) return loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);
  loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}

const cache = new Map<string, Promise<Object3D>>();

/** The cached scene graph. Do not mutate it — see `loadGLTFScene`. */
export function loadGLTF(url: string): Promise<Object3D> {
  const hit = cache.get(url);
  if (hit) return hit;
  const pending = new Promise<Object3D>((resolve, reject) => {
    getLoader().load(
      url,
      (gltf) => resolve(gltf.scene as unknown as Object3D),
      undefined,
      reject,
    );
  }).catch((error: unknown) => {
    // A failed load must not poison the cache — the Process cards retry on the
    // next scroll-in, and a transient network failure should not blank the card
    // for the rest of the session.
    cache.delete(url);
    throw error;
  });
  cache.set(url, pending);
  return pending;
}

/** A private copy of the model, safe to re-material and re-transform. */
export async function loadGLTFScene(url: string): Promise<Object3D> {
  return (await loadGLTF(url)).clone(true);
}

/**
 * Warm the cache without drawing anything.
 *
 * ponytail: this is what `preloadAssets.ts` should call, instead of
 * `import()`ing the component module for the side effect of its top-level
 * `useGLTF.preload`. That trick pulled a 144KB canvas chunk onto the idle path
 * to populate a cache, and only worked because drei's cache was a module
 * global — which is exactly what this is, minus the component.
 */
export function preloadGLTF(url: string): void {
  void loadGLTF(url).catch(() => {});
}
