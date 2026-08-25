/**
 * Screen-space ASCII field — GLSL port of `Archive (1)/js/getMaterial.js`.
 *
 * The Archive wrote this as a `three/webgpu` NodeMaterial in TSL, which this
 * site cannot run: everything here is the WebGLRenderer under R3F. So the two
 * TSL functions are transcribed by hand — `positionMath` into the vertex stage
 * and `asciiCode` into the fragment stage.
 *
 * One instance per grid cell. `aPixelUV` names the cell's slot in the offscreen
 * render of the real 3D scene; its brightness picks a column out of the Duforn
 * strip in `asciiAtlas.ts`, and the quad draws that one glyph.
 */

/** Trim so linear filtering cannot bleed the neighbouring glyph in. */
const CELL_INSET = 0.98;

export const ASCII_FIELD_VERT = /* glsl */ `
attribute vec3 aPosition;
attribute vec2 aPixelUV;
attribute float aRandom;

uniform float uWarp;

varying vec2 vUv;
varying vec2 vPixelUV;
varying float vRandom;

void main() {
  vUv = uv;
  vPixelUV = aPixelUV;
  vRandom = aRandom;

  // Archive's positionMath: polar re-radius. uWarp == 1. is the identity, so a
  // surface that wants a straight lattice pays nothing for the branch.
  vec2 grid = aPosition.xy;
  float r = length(grid);
  vec2 warped = grid;
  if (uWarp != 1.0 && r > 0.0001) {
    float theta = atan(grid.y, grid.x);
    warped = pow(r, uWarp) * vec2(cos(theta), sin(theta));
  }

  vec3 origin = vec3(warped, aPosition.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + origin, 1.0);
}
`;

export const ASCII_FIELD_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uAtlas;
uniform float uGlyphCount;
uniform vec3 uColor;
uniform float uGamma;
uniform float uGlyphScale;
uniform float uJitter;
uniform float uTime;
uniform float uNoise;

varying vec2 vUv;
varying vec2 vPixelUV;
varying float vRandom;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float CELL_INSET = ${CELL_INSET.toFixed(3)};

float random2(vec2 st) {
  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise2d(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random2(i);
  float b = random2(i + vec2(1., 0.));
  float c = random2(i + vec2(0., 1.));
  float d = random2(i + vec2(1., 1.));
  vec2 u = f * f * (3. - 2. * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1. - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec4 src = texture2D(uScene, vPixelUV);
  // The offscreen clear is transparent, so bare background draws no glyph at
  // all. That is what keeps the Process cards and the About plate see-through.
  if (src.a < 0.02) discard;

  // Archive read the red channel off a greyscale portrait. A lit render is
  // not greyscale, so weight the channels; alpha fades cells the mesh clips.
  float lum = dot(src.rgb, LUMA) * src.a;
  float brightness = clamp(pow(lum, uGamma) + vRandom * uJitter, 0., 0.99);

  float index = floor(brightness * uGlyphCount);

  // Above 1 the glyph is cropped in rather than shrunk, which fills the cell
  // and reads denser; below 1 it shrinks and the surround has to drop out.
  vec2 glyphCell = (clamp(vUv, 0., 1.) - 0.5) / max(uGlyphScale, 0.05) + 0.5;
  if (glyphCell.x < 0. || glyphCell.x > 1.) discard;
  if (glyphCell.y < 0. || glyphCell.y > 1.) discard;

  float column = 0.5 + (glyphCell.x - 0.5) * CELL_INSET;
  vec2 atlasUv = vec2((column + index) / uGlyphCount, glyphCell.y);
  float chr = texture2D(uAtlas, atlasUv).a;

  float flicker = 1.;
  if (uNoise > 0.001) {
    float n = noise2d(vPixelUV * 1000. + uTime);
    flicker = mix(1., mix(0.7, 1.15, smoothstep(0.5, 1., n)), uNoise);
  }

  float alpha = chr * flicker;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;
