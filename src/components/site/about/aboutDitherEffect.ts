import { Effect } from "postprocessing";
import * as THREE from "three";
import ditheringShader from "./aboutDitherShader";

/**
 * Interface for dithering effect options
 * From niccolofanton/dithering-shader
 */
export interface DitheringEffectOptions {
  time?: number;
  resolution?: THREE.Vector2;
  gridSize?: number;
  luminanceMethod?: number;
  invertColor?: boolean;
  pixelSizeRatio?: number;
  grayscaleOnly?: boolean;
}

/**
 * Implementation of the dithering effect
 * Applies a dithering pattern to the rendered scene
 */
export class DitheringEffect extends Effect {
  /**
   * Map of uniforms used by the shader
   */
  uniforms: Map<string, THREE.Uniform<number | THREE.Vector2>>;

  /**
   * Creates a new dithering effect instance
   * @param options - Configuration options for the effect
   */
  constructor({
    time = 0,
    resolution = new THREE.Vector2(1, 1),
    gridSize = 4.0,
    luminanceMethod = 0,
    invertColor = false,
    pixelSizeRatio = 1,
    grayscaleOnly = false,
  }: DitheringEffectOptions = {}) {
    const uniforms = new Map<string, THREE.Uniform<number | THREE.Vector2>>([
      ["time", new THREE.Uniform(time)],
      ["resolution", new THREE.Uniform(resolution)],
      ["gridSize", new THREE.Uniform(gridSize)],
      ["luminanceMethod", new THREE.Uniform(luminanceMethod)],
      ["invertColor", new THREE.Uniform(invertColor ? 1 : 0)],
      ["ditheringEnabled", new THREE.Uniform(1)],
      ["pixelSizeRatio", new THREE.Uniform(pixelSizeRatio)],
      ["grayscaleOnly", new THREE.Uniform(grayscaleOnly ? 1 : 0)],
    ]);

    super("DitheringEffect", ditheringShader, {
      uniforms,
    });

    this.uniforms = uniforms;
  }

  /**
   * Updates the effect parameters on each frame
   */
  update(
    _renderer: THREE.WebGLRenderer,
    inputBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
  ): void {
    const timeUniform = this.uniforms.get("time");
    if (timeUniform !== undefined && typeof timeUniform.value === "number") {
      timeUniform.value += deltaTime;
    }

    const resolutionUniform = this.uniforms.get("resolution");
    if (resolutionUniform !== undefined && resolutionUniform.value instanceof THREE.Vector2) {
      resolutionUniform.value.set(inputBuffer.width, inputBuffer.height);
    }
  }

  /**
   * Sets the grid size for the dithering pattern
   */
  setGridSize(size: number): void {
    const gridSizeUniform = this.uniforms.get("gridSize");
    if (gridSizeUniform !== undefined) {
      gridSizeUniform.value = size;
    }
  }

  /**
   * Sets the pixel size ratio for the pixelation effect
   */
  setPixelSizeRatio(ratio: number): void {
    const pixelSizeRatioUniform = this.uniforms.get("pixelSizeRatio");
    if (pixelSizeRatioUniform !== undefined) {
      pixelSizeRatioUniform.value = ratio;
    }
  }

  /**
   * Enables or disables grayscale-only mode
   */
  setGrayscaleOnly(grayscaleOnly: boolean): void {
    const grayscaleOnlyUniform = this.uniforms.get("grayscaleOnly");
    if (grayscaleOnlyUniform !== undefined) {
      grayscaleOnlyUniform.value = grayscaleOnly ? 1 : 0;
    }
  }

  /**
   * Enables or disables color inversion
   */
  setInvertColor(invertColor: boolean): void {
    const invertColorUniform = this.uniforms.get("invertColor");
    if (invertColorUniform !== undefined) {
      invertColorUniform.value = invertColor ? 1 : 0;
    }
  }
}
