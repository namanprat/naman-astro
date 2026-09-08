/**
 * One-shot: strip textures/UVs (ASCII only reads lit positions) and Draco-compress
 * the three Process-card GLBs in place.
 *
 * ponytail: the four packages below are deliberately absent from package.json
 * and this file is wired to no npm script. They are build tooling for a job
 * that has already been done — the compressed GLBs are committed — so carrying
 * them as a dependency would tax every `npm install` on the repo forever to
 * serve a run that happens when the source models change, which is close to
 * never. The cost is that this script throws on a missing import if run cold;
 * the line below is the fix, and it is the whole setup.
 *
 *   npm install --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions draco3dgltf
 *   node scripts/compress-process-models.mjs
 */
import { writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, prune } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["1.glb", "2.glb", "3.glb"];

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

function stripForAscii(document) {
  const root = document.getRoot();
  for (const texture of root.listTextures()) texture.dispose();
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of prim.listSemantics()) {
        if (
          semantic.startsWith("TEXCOORD") ||
          semantic === "TANGENT" ||
          semantic.startsWith("COLOR")
        ) {
          prim.setAttribute(semantic, null);
        }
      }
    }
  }
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

for (const name of FILES) {
  const path = join(ROOT, "public/models", name);
  const before = statSync(path).size;
  const document = await io.read(path);
  stripForAscii(document);
  await document.transform(
    dedup(),
    prune(),
    draco({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  );
  const bytes = await io.writeBinary(document);
  writeFileSync(path, bytes);
  const after = statSync(path).size;
  console.log(
    `${name}: ${kb(before)} → ${kb(after)} (${((after / before) * 100).toFixed(1)}%)`,
  );
}
