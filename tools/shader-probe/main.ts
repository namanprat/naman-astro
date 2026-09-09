/**
 * Probe: the ASCII field's TSL graph, on the WebGL2 backend.
 *
 * Asserts two things, because only the pair is meaningful:
 *  - with a lit scene texture the field draws (a graph that discards everything
 *    still compiles and renders without error);
 *  - with `opacity` at 0 it draws nothing, which is the exact failure the GLSL
 *    version invited — alpha was multiplied by `uOpacity` unconditionally, so a
 *    call site that forgot to declare the uniform read 0 and blanked the field.
 */
import {
  LinearSRGBColorSpace,
  Mesh,
  NoToneMapping,
  OrthographicCamera,
  RenderTarget,
  Scene,
  WebGPURenderer,
} from "three/webgpu";
import { createAsciiFieldMaterial } from "@/lib/site/ascii/asciiFieldNodes";
import { buildAsciiGridGpu } from "@/lib/site/ascii/asciiGridGpu";

const SIZE = 256;

function report(text: string): void {
  document.title = text;
  const out = document.getElementById("out");
  if (out) out.textContent = text;
  console.log("PROBE:" + text);
}

async function main(): Promise<void> {
  const host = document.getElementById("host")!;
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);

  const renderer = new WebGPURenderer({
    canvas,
    alpha: true,
    forceWebGL: true,
  });
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = LinearSRGBColorSpace;
  await renderer.init();
  renderer.setSize(SIZE, SIZE, false);

  const { material, uniforms } = createAsciiFieldMaterial();
  uniforms.glyphCount.value = 6;
  uniforms.hasHighlight.value = 1;
  uniforms.opaqueGlyphs.value = 1;
  uniforms.warp.value = 0.8;
  uniforms.charNoise.value = 0.85;

  const grid = buildAsciiGridGpu(24, 1);
  const mesh = new Mesh(grid.geometry, material);
  mesh.frustumCulled = false;

  const scene = new Scene();
  scene.add(mesh);
  const camera = new OrthographicCamera(-1, 1, 1, -1, -1, 1);

  // Where WGSL/GLSL is actually generated. A graph that typechecks but cannot
  // codegen fails here rather than at render.
  await renderer.compileAsync(scene, camera);

  const target = new RenderTarget(SIZE, SIZE);
  const coverage = async (): Promise<number> => {
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const px = await renderer.readRenderTargetPixelsAsync(
      target,
      0,
      0,
      SIZE,
      SIZE,
    );
    let lit = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 8) lit++;
    return (lit / (SIZE * SIZE)) * 100;
  };

  const drawn = await coverage();
  uniforms.opacity.value = 0;
  const blanked = await coverage();

  const ok = drawn > 10 && blanked === 0;
  report(
    `${ok ? "OK" : "FAIL"} ascii: drawn=${drawn.toFixed(1)}% opacity0=${blanked.toFixed(1)}%`,
  );
}

main().catch((err: unknown) => {
  report(
    "FAIL " + (err instanceof Error ? (err.stack ?? err.message) : String(err)),
  );
});
