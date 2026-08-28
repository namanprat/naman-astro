/**
 * Self-check for the hero glass tuning store.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import {
  HERO_GLASS_DEFAULTS,
  getHeroGlass,
  resetHeroGlass,
  serializeHeroGlass,
} from "../src/lib/site/heroGlass.ts";

resetHeroGlass();
const live = getHeroGlass();
assert.equal(live.transmission, HERO_GLASS_DEFAULTS.transmission);
assert.equal(live.roughness, HERO_GLASS_DEFAULTS.roughness);
assert.equal(live.color, HERO_GLASS_DEFAULTS.color);

live.roughness = 0.8;
live.scale = 1.4;
const json = serializeHeroGlass();
assert.match(json, /"roughness": 0.8/);
assert.match(json, /"scale": 1.4/);

resetHeroGlass();
assert.equal(getHeroGlass().roughness, HERO_GLASS_DEFAULTS.roughness);
assert.equal(getHeroGlass().scale, HERO_GLASS_DEFAULTS.scale);

console.log("heroGlass: all assertions passed");
