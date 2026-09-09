/**
 * A lighting environment baked from emissive shapes, with no HDR over the wire.
 *
 * Replaces drei's `<Environment>` + `<Lightformer>`. Both call sites used it the
 * same way: a handful of glowing rectangles and circles arranged around the
 * subject, rendered once to a small cubemap. The hero's comment is explicit that
 * this is deliberate — the alternative was a 6.7MB `env.hdr`.
 *
 * ponytail: `PMREMGenerator` imported from `three/webgpu`, not from `three`.
 * There are two classes with this name. The one in `three` is WebGLRenderer-only
 * — it reaches for `renderer.xr` and `renderer.state.buffers.depth`, neither of
 * which the node renderer has. The renderer-agnostic one lives at
 * `renderers/common/extras/PMREMGenerator.js` and is re-exported from the
 * `three/webgpu` entry point. Importing the wrong one typechecks and then fails
 * at runtime, so the import line is load-bearing.
 *
 * ponytail: baked once and cached, matching drei's `frames: 1`. Nothing in
 * either environment moves, so re-rendering the cubemap per frame would buy
 * nothing and cost a full PMREM convolution.
 */
import {
  CircleGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  type Texture,
  type WebGPURenderer,
} from "three/webgpu";

export type LightformerSpec = {
  form: "rect" | "circle";
  intensity: number;
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  /** `[width, height]` for a rect, radius for a circle. */
  scale: readonly [number, number] | number;
  /** Defaults to white. */
  color?: number | string;
};

export type EnvironmentHandle = {
  texture: Texture;
  dispose(): void;
};

function lightformer(spec: LightformerSpec): Mesh {
  const geometry =
    spec.form === "circle"
      ? new CircleGeometry(typeof spec.scale === "number" ? spec.scale : 1, 32)
      : new PlaneGeometry(1, 1);

  // Intensity rides on the material colour rather than an emissive channel:
  // `MeshBasicNodeMaterial` writes its colour straight out, and the PMREM pass
  // reads exactly that, so a colour above 1 is what makes a lightformer bright.
  const material = new MeshBasicNodeMaterial({
    color: new Color(spec.color ?? 0xffffff).multiplyScalar(spec.intensity),
    side: DoubleSide,
    toneMapped: false,
  });

  const mesh = new Mesh(geometry, material);
  mesh.position.set(...spec.position);
  if (spec.rotation) mesh.rotation.set(...spec.rotation);
  if (spec.form === "rect" && Array.isArray(spec.scale)) {
    mesh.scale.set(spec.scale[0], spec.scale[1], 1);
  }
  return mesh;
}

/**
 * Bakes `specs` to a prefiltered environment map.
 *
 * Must be called after `await renderer.init()` — `fromScene` throws otherwise,
 * like every other method on the node renderer that touches the backend.
 */
export function buildEnvironment(
  renderer: WebGPURenderer,
  specs: readonly LightformerSpec[],
  size = 256,
): EnvironmentHandle {
  const scene = new Scene();
  const meshes = specs.map(lightformer);
  for (const mesh of meshes) scene.add(mesh);

  const generator = new PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0, 0.1, 100, { size });
  generator.dispose();

  for (const mesh of meshes) {
    mesh.geometry.dispose();
    (mesh.material as MeshBasicNodeMaterial).dispose();
  }

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}
