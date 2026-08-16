import { Effect } from "postprocessing";
import * as THREE from "three";

/** Shared state — hover driver writes, effect reads each frame. */
export const aboutDistortionState = {
  pointer: new THREE.Vector2(0.5, 0.5),
  strength: 0,
  strengthTarget: 0,
};

const distortionShader = /*glsl*/ `
uniform vec2 uPointer;
uniform float uStrength;
uniform float uTime;
uniform vec2 resolution;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uStrength <= 0.001) {
    outputColor = inputColor;
    return;
  }

  vec2 p = uv - uPointer;
  p.x *= resolution.x / max(resolution.y, 1.0);
  float dist = length(p);

  float bulge = exp(-dist * dist * 5.5);
  float ripple = sin(dist * 24.0 - uTime * 5.0) * 0.35;
  float warp = uStrength * bulge * (0.14 + ripple * 0.06);
  vec2 dir = dist > 0.0001 ? normalize(p) : vec2(0.0);
  vec2 warped = clamp(uv + dir * warp, 0.0, 1.0);

  float split = uStrength * bulge * 0.012;
  vec2 splitDir = vec2(dir.y, -dir.x);
  vec3 col;
  col.r = texture2D(inputBuffer, clamp(warped + splitDir * split, 0.0, 1.0)).r;
  col.g = texture2D(inputBuffer, warped).g;
  col.b = texture2D(inputBuffer, clamp(warped - splitDir * split, 0.0, 1.0)).b;

  outputColor = vec4(col, inputColor.a);
}`;

export interface AboutDistortionEffectOptions {
  time?: number;
  resolution?: THREE.Vector2;
}

export class AboutDistortionEffect extends Effect {
  uniforms: Map<string, THREE.Uniform<number | THREE.Vector2>>;
  private readonly uTime: THREE.Uniform<number>;
  private readonly uPointer: THREE.Uniform<THREE.Vector2>;
  private readonly uStrength: THREE.Uniform<number>;
  private readonly uResolution: THREE.Uniform<THREE.Vector2>;

  constructor({
    time = 0,
    resolution = new THREE.Vector2(1, 1),
  }: AboutDistortionEffectOptions = {}) {
    const uTime = new THREE.Uniform(time);
    const uPointer = new THREE.Uniform(new THREE.Vector2(0.5, 0.5));
    const uStrength = new THREE.Uniform(0);
    const uResolution = new THREE.Uniform(resolution);

    const uniforms = new Map<string, THREE.Uniform<number | THREE.Vector2>>([
      ["uTime", uTime],
      ["uPointer", uPointer],
      ["uStrength", uStrength],
      ["resolution", uResolution],
    ]);

    super("AboutDistortionEffect", distortionShader, { uniforms });
    this.uniforms = uniforms;
    this.uTime = uTime;
    this.uPointer = uPointer;
    this.uStrength = uStrength;
    this.uResolution = uResolution;
  }

  update(
    _renderer: THREE.WebGLRenderer,
    inputBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
  ): void {
    this.uTime.value += deltaTime;
    this.uResolution.value.set(inputBuffer.width, inputBuffer.height);
    this.uPointer.value.copy(aboutDistortionState.pointer);
    this.uStrength.value = aboutDistortionState.strength;
  }
}
