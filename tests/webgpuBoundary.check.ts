/**
 * Self-check for the one migration rule TypeScript cannot enforce.
 *   npm run test:unit
 *
 * `three/webgpu` is built from its own Rollup entry (`src/Three.WebGPU.js`) — it
 * does not re-export `three.module.js` — so a page that reaches both entry
 * points ends up with two independent copies of every class. A `Texture` from
 * one is not `instanceof` the other's `Texture`, and the symptoms are a material
 * silently ignoring a map or an internal type check quietly failing. TypeScript
 * sees two structurally identical declarations and says nothing, which is why
 * this is a test and not a type.
 *
 * `three/tsl` is built with `three/webgpu` marked external, so those two always
 * share instances. Plain `three` is the only trap.
 *
 * The walk is transitive: importing a helper that imports `three` is the same
 * mistake as importing `three` directly, and is how it will actually happen.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

const files = walk(SRC);
const source = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

/** Every module specifier in `import`/`export ... from` position. */
function specifiers(code: string): string[] {
  return [...code.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]);
}

/** Resolve a local specifier to a file we have, or null for a bare package. */
function resolveLocal(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
  ]) {
    if (source.has(candidate)) return candidate;
  }
  return null;
}

const importsPlainThree = (code: string) =>
  specifiers(code).some((s) => s === "three");
const importsWebGPU = (code: string) =>
  specifiers(code).some((s) => s === "three/webgpu" || s === "three/tsl");

/** Files reachable from `entry` through local imports, including itself. */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specifiers(source.get(file) ?? "")) {
      const local = resolveLocal(file, spec);
      if (local) queue.push(local);
    }
  }
  return seen;
}

const roots = files.filter((f) => importsWebGPU(source.get(f) ?? ""));
assert.ok(
  roots.length > 0,
  "no module imports three/webgpu — this check has stopped checking anything",
);

const violations: string[] = [];
for (const root of roots) {
  for (const file of reachable(root)) {
    if (!importsPlainThree(source.get(file) ?? "")) continue;
    const via = file === root ? "directly" : `via ${relative(SRC, file)}`;
    violations.push(`${relative(SRC, root)} reaches plain "three" ${via}`);
  }
}

assert.deepEqual(
  violations.sort(),
  [],
  `WebGPU modules must not reach plain "three":\n  ${violations.join("\n  ")}`,
);

console.log(
  `webgpuBoundary: ${roots.length} WebGPU module(s) clear of plain "three".`,
);
