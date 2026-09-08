#!/usr/bin/env node
/**
 * Run every `tests/*.check.ts` under Node's type stripping, in name order.
 *
 * ponytail: a glob, not a list. `test:unit` used to spell out all seven files
 * in one `&&` chain in package.json, which meant a new check ran only if
 * someone remembered to extend that string — a check that silently never runs
 * is worse than no check. Discovery is by filename so adding a file is the
 * whole of adding a check.
 *
 * `.check.ts` is the unit suffix, so the pattern is exact rather than `*.ts`.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS = join(dirname(fileURLToPath(import.meta.url)), "..", "tests");

const checks = readdirSync(TESTS)
  .filter((name) => name.endsWith(".check.ts"))
  .sort();

if (!checks.length) {
  console.error("run-checks: no tests/*.check.ts found.");
  process.exit(1);
}

let failed = 0;
for (const name of checks) {
  // ponytail: `stdio: "inherit"` rather than capturing — each check prints its
  // own assertions as it goes, and buffering them would hide which one hung.
  const { status } = spawnSync(
    process.execPath,
    ["--experimental-strip-types", join(TESTS, name)],
    { stdio: "inherit" },
  );
  if (status !== 0) {
    console.error(`${name}: exit ${status}`);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed} of ${checks.length} check(s) failed.`);
  process.exit(1);
}
console.log(`run-checks: ${checks.length} checks passed.`);
