/**
 * Lighting-based Duforn ASCII for Process card primitives.
 * Lambert + rim pick a glyph; the lattice is screen-space so characters
 * stay upright as the mesh turns. Atlas comes from `teamCylinderAscii`.
 */
export const SHAPE_ASCII_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const SHAPE_ASCII_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;
uniform sampler2D uAsciiTexture;
uniform float uGlyphCount;
uniform float uGranularity;
uniform float uFontSize;
uniform float uSurfaceAspect;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform float uTime;
uniform float uNoise;

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

float sampleGlyph(float index, vec2 inCell) {
  inCell = clamp(inCell, 0., 1.);
  vec2 glyphUV = vec2((index + inCell.x) / uGlyphCount, inCell.y);
  return texture2D(uAsciiTexture, glyphUV).a;
}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 L = normalize(vec3(0.35, 0.55, 0.75));
  float ndotl = max(dot(N, L), 0.);
  float rim = pow(1. - max(dot(N, normalize(vViewDir)), 0.), 2.);
  float lum = clamp(0.08 + ndotl * 0.7 + rim * 0.45, 0., 1.);

  float cellsV = max(uGranularity, 1.);
  float aspect = uSurfaceAspect > 0.001 ? uSurfaceAspect
    : uResolution.x / max(uResolution.y, 1.);
  vec2 cells = vec2(max(cellsV * aspect, 1.), cellsV);
  vec2 gridUv = gl_FragCoord.xy / max(uResolution, vec2(1.));
  vec2 cellId = floor(gridUv * cells);
  vec2 inCell = fract(gridUv * cells);

  float index = floor(lum * (uGlyphCount - 1.) + 0.5);
  float size = max(uFontSize, 0.05);
  vec2 glyphInCell = (inCell - 0.5) / size + 0.5;
  float outside = step(glyphInCell.x, 0.) + step(1., glyphInCell.x)
    + step(glyphInCell.y, 0.) + step(1., glyphInCell.y);
  float chr = outside > 0.5 ? 0. : sampleGlyph(index, glyphInCell);

  float flicker = 1.;
  if (uNoise > 0.001) {
    float n = noise2d(cellId + uTime);
    flicker = mix(1., mix(0.7, 1.15, smoothstep(0.5, 1., n)), uNoise);
  }

  if (chr * flicker < 0.01) discard;
  gl_FragColor = vec4(uColor, chr * flicker);
}
`;
