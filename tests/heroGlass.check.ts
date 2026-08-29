/**
 * Self-check for the hero glass helpers.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import {
  HERO_SCENE_URL,
  HERO_WORDMARK_URL,
  canMountHeroGlass,
  heroGlassGuiEnabled,
} from "../src/lib/site/heroGlass.ts";

assert.equal(HERO_SCENE_URL, "/models/hero-scene.glb");
assert.equal(HERO_WORDMARK_URL, "/main-assets/name-hero.svg");
assert.equal(canMountHeroGlass(), false);
assert.equal(heroGlassGuiEnabled(), false);

console.log("heroGlass: all assertions passed");
