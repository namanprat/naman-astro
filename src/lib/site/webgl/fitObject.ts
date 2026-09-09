/**
 * Centre a loaded model, and normalise it to a unit box.
 *
 * Replaces drei's `<Center>`, which both call sites used only for its default
 * behaviour, plus the hand-rolled unit-normalising that `HeroLogoShell` and the
 * About bust each wrote out again.
 *
 * ponytail: `unit` is `1 / longest axis`, not a per-axis scale. Every consumer
 * multiplies it by a viewport measurement to place the model against DOM
 * geometry — the hero logo against the wordmark lockup, the bust against its
 * figure box — so the model has to keep its proportions and reach a known size
 * along its longest axis. A per-axis fit would make each of those measurements
 * mean something different.
 */
import {
  Box3,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from "three/webgpu";

const _box = new Box3();
const _size = new Vector3();
const _center = new Vector3();

/** Moves `object` so its bounding box is centred on the origin. */
export function centerObject(object: Object3D): Object3D {
  object.updateMatrixWorld(true);
  _box.setFromObject(object).getCenter(_center);
  object.position.sub(_center);
  return object;
}

/** `1 / longest axis` of the object's bounding box, safe on a degenerate box. */
export function unitScale(object: Object3D): number {
  object.updateMatrixWorld(true);
  _box.setFromObject(object).getSize(_size);
  return 1 / Math.max(_size.x, _size.y, _size.z, 1e-6);
}

/**
 * The first mesh's geometry, baked to world space, centred, with normals.
 *
 * ponytail: baked to `matrixWorld` before centring, not used as authored. The
 * hero logo GLB carries its placement on the node rather than in the vertices,
 * so reading `mesh.geometry` alone yields a mark that is centred on the wrong
 * point and scaled by whatever the exporter left on the parent.
 */
export function flattenFirstMesh(
  root: Object3D,
): { geometry: BufferGeometry; unit: number } | null {
  root.updateMatrixWorld(true);
  let geometry: BufferGeometry | null = null;
  root.traverse((child) => {
    if (geometry) return;
    const mesh = child as Object3D & {
      isMesh?: boolean;
      geometry?: BufferGeometry;
    };
    if (!mesh.isMesh || !mesh.geometry) return;
    geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
  });
  if (!geometry) return null;

  const geo: BufferGeometry = geometry;
  geo.center();
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.boundingBox!.getSize(_size);
  return { geometry: geo, unit: 1 / Math.max(_size.x, _size.y, _size.z, 1e-6) };
}
