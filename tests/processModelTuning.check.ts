/**
 * Self-check for the Process-card model tuning store.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import {
  PROCESS_CARD_IDS,
  PROCESS_MODEL_DEFAULTS,
  PROCESS_MODEL_URLS,
  getProcessModelTuning,
  resetProcessModelTuning,
  serializeProcessModelTuning,
} from "../src/lib/site/process/processModelTuning.ts";

resetProcessModelTuning();

assert.deepEqual(
  [...PROCESS_CARD_IDS],
  ["1", "2", "3"],
  "three cards, one GLB each",
);
assert.equal(PROCESS_MODEL_URLS["1"], "/models/1.glb");
assert.equal(PROCESS_MODEL_URLS["2"], "/models/2.glb");
assert.equal(PROCESS_MODEL_URLS["3"], "/models/3.glb");

for (const id of PROCESS_CARD_IDS) {
  const live = getProcessModelTuning(id);
  assert.equal(
    live.scale,
    PROCESS_MODEL_DEFAULTS[id].scale,
    `${id} starts at its default scale`,
  );
}

getProcessModelTuning("1").scale = 3.21;
assert.equal(getProcessModelTuning("1").scale, 3.21, "mutates in place");
assert.equal(
  getProcessModelTuning("2").scale,
  PROCESS_MODEL_DEFAULTS["2"].scale,
  "cards do not share one object",
);

const json = serializeProcessModelTuning();
const parsed = JSON.parse(json) as { "1": { scale: number } };
assert.equal(parsed["1"].scale, 3.21, "serialize sees the live mutation");

resetProcessModelTuning();
assert.equal(
  getProcessModelTuning("1").scale,
  PROCESS_MODEL_DEFAULTS["1"].scale,
  "reset restores defaults",
);

console.log("processModelTuning: all assertions passed");
