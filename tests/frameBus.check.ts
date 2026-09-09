/**
 * Self-check for the per-frame callback ordering.
 *   npm run test:unit
 *
 * Every assertion here stands in for a bug that renders without erroring: the
 * hero's four subscribers each read what the previous one wrote, so a wrong
 * order shears the ASCII glyphs off the glass by a frame rather than throwing.
 */
import assert from "node:assert/strict";
import { createFrameBus } from "../src/lib/site/webgl/frameBus.ts";

/** Records the order callbacks fired in, as the labels they were added under. */
function tracer() {
  const seen: string[] = [];
  const bus = createFrameBus();
  const at = (label: string, priority?: number) =>
    bus.add(() => seen.push(label), priority);
  return { seen, bus, at };
}

// The hero's real stack, subscribed in an order that is not its running order.
{
  const { seen, bus, at } = tracer();
  at("wordmark", 0);
  at("spin", -3);
  at("ascii-matte", -1);
  at("viewOffset", -3);
  bus.run(0.016, 1);
  assert.deepEqual(
    seen,
    ["spin", "viewOffset", "ascii-matte", "wordmark"],
    "ascending priority, and equal priorities keep subscription order",
  );
}

// Sorting survives a subscriber arriving after the first frame — the hero glass
// is a lazy chunk, so it always does.
{
  const { seen, bus, at } = tracer();
  at("wordmark", 0);
  bus.run(0.016, 1);
  at("spin", -3);
  seen.length = 0;
  bus.run(0.016, 2);
  assert.deepEqual(seen, ["spin", "wordmark"], "a late subscriber re-sorts");
}

// Callbacks get the frame delta and elapsed time, unmodified.
{
  const bus = createFrameBus();
  let got: [number, number] | null = null;
  bus.add((dt, elapsed) => {
    got = [dt, elapsed];
  });
  bus.run(0.016, 12.5);
  assert.deepEqual(got, [0.016, 12.5], "dt and elapsed pass through");
}

// Unsubscribing from inside a callback must not skip the next subscriber.
{
  const { seen, bus, at } = tracer();
  let off: (() => void) | null = null;
  off = bus.add(() => {
    seen.push("self");
    off?.();
  }, -1);
  at("after", 0);
  bus.run(0.016, 1);
  assert.deepEqual(seen, ["self", "after"], "self-removal does not skip");
  seen.length = 0;
  bus.run(0.016, 2);
  assert.deepEqual(seen, ["after"], "and the removal took effect");
  assert.equal(bus.size, 1);
}

// A double unsubscribe must not evict someone else.
{
  const { seen, bus, at } = tracer();
  const off = at("gone", 0);
  at("kept", 0);
  off();
  off();
  bus.run(0.016, 1);
  assert.deepEqual(seen, ["kept"], "unsubscribe is idempotent");
}

// The draw override: null means the stage renders itself.
{
  const bus = createFrameBus();
  assert.equal(bus.render, null, "no override by default");
  const draw = () => {};
  bus.setRender(draw);
  assert.equal(bus.render, draw, "the override owns the draw");
  bus.setRender(null);
  assert.equal(bus.render, null, "and hands it back");
}

// clear() drops both, so a disposed stage cannot keep drawing.
{
  const { bus, at } = tracer();
  at("a");
  bus.setRender(() => {});
  bus.clear();
  assert.equal(bus.size, 0);
  assert.equal(bus.render, null, "clear drops the override too");
}

console.log("frameBus: all assertions passed");
