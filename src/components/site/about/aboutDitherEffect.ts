import { Effect } from "postprocessing";
import * as THREE from "three";
import ditheringShader from "./aboutDitherShader";

/** Ordered dither for the About bust. Look is baked into the shader. */
export class DitheringEffect extends Effect {
  uniforms: Map<string, THREE.Uniform<THREE.Vector2>>;

  constructor() {
    const uniforms = new Map<string, THREE.Uniform<THREE.Vector2>>([
      ["resolution", new THREE.Uniform(new THREE.Vector2(1, 1))],
    ]);

    super("DitheringEffect", ditheringShader, { uniforms });
    this.uniforms = uniforms;
  }

  update(
    _renderer: THREE.WebGLRenderer,
    inputBuffer: THREE.WebGLRenderTarget,
  ): void {
    const resolutionUniform = this.uniforms.get("resolution");
    if (resolutionUniform !== undefined) {
      resolutionUniform.value.set(inputBuffer.width, inputBuffer.height);
    }
  }
}
