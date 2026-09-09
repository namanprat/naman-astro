/**
 * Screen-space ASCII field, as TSL node graphs.
 *
 * This is a restoration, not a rewrite. `asciiFieldShader.ts` opens by saying
 * so: the Archive wrote `positionMath` and `asciiCode` as a `three/webgpu`
 * NodeMaterial in TSL, and they were transcribed to GLSL by hand only because
 * "everything here is the WebGLRenderer under R3F". With the renderer gone,
 * the two functions go back to being nodes.
 *
 * ponytail: one graph, three call sites. The GLSL pair had to be re-wired by
 * hand into a `ShaderMaterial` at each of `AsciiField`, `FooterAsciiField` and
 * `HeroAsciiReveal`, and the footer's copy carries a comment about having to
 * declare uniforms it never uses — because an undeclared uniform reads 0 and
 * the shader multiplies alpha by `uOpacity` unconditionally, so forgetting one
 * silently discards every glyph. A factory with real defaults removes the whole
 * class of bug.
 *
 * ponytail: fragment-stage nodes only — no `storage()`, no `textureStore()`,
 * no compute. TSL compiles to both WGSL and GLSL, but TSL *compute* has no
 * WebGL2 path (`GLSLNodeBuilder` has no `textureStore` at all), and this site
 * promises the WebGL2 fallback to Safari below 26. Anything here that reached
 * for compute would blank the glyphs on those browsers with no error anywhere.
 */
import {
  CanvasTexture,
  Color,
  DataTexture,
  DoubleSide,
  NodeMaterial,
  SRGBColorSpace,
  type Texture,
} from "three/webgpu";
import {
  Discard,
  Fn,
  atan,
  attribute,
  clamp,
  cos,
  dot,
  float,
  floor,
  fract,
  max,
  min,
  mix,
  positionLocal,
  pow,
  screenUV,
  select,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  workingToColorSpace,
} from "three/tsl";

/**
 * `@types/three` declares `ColorSpaceNode` as a bare `TempNode` with no node-type
 * parameter, so a converted colour cannot flow into `dot()` without help. The
 * runtime node is a vec3; only the declaration is lossy — hence one cast, here,
 * rather than at each use.
 */
const toSRGB = (node: Parameters<typeof workingToColorSpace>[0]) =>
  workingToColorSpace(node, SRGBColorSpace);
const asVec3 = (node: ReturnType<typeof workingToColorSpace>) =>
  vec3(node as unknown as ReturnType<typeof vec3>);

/** Trim so linear filtering cannot bleed the neighbouring glyph in. */
const CELL_INSET = 0.98;

const LUMA = vec3(0.2126, 0.7152, 0.0722);

/** A 1×1 opaque white stand-in, so a graph can be built before textures load. */
function placeholder(): DataTexture {
  const tex = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  tex.needsUpdate = true;
  return tex;
}

export type AsciiFieldUniforms = ReturnType<typeof createAsciiFieldUniforms>;

/**
 * Every knob the field takes, as live handles.
 *
 * Assign through `.value` — these are the same objects the graph closed over,
 * so a write lands on the next frame with no recompile.
 */
export function createAsciiFieldUniforms() {
  return {
    /** The offscreen render of the real 3D subject. */
    scene: texture(placeholder()),
    /** The Duforn glyph strip, sparse → dense. */
    atlas: texture(placeholder()),
    /** Per-cell pointer/scroll highlight mask, red channel. */
    highlight: texture(placeholder()),
    /** The fluid dye, for surfaces that only draw inside the trail. */
    fluid: texture(placeholder()),

    glyphCount: uniform(1),
    color: uniform(new Color(0x8b8b8b)),
    highlightColor: uniform(new Color(0x8b8b8b)),
    hasHighlight: uniform(0),
    gamma: uniform(0.8),
    glyphScale: uniform(2.2),
    jitter: uniform(0.02),
    time: uniform(0),
    noise: uniform(0.6),
    charNoise: uniform(0),
    opaqueGlyphs: uniform(0),
    hasFluid: uniform(0),
    fluidThreshold: uniform(1),
    fluidSoft: uniform(0),
    /** Flat multiplier on every glyph. 1 leaves the field as it was. */
    opacity: uniform(1),
    /** Polar re-radius. 1 is the identity. */
    warp: uniform(1),
  };
}

/**
 * The Archive's `positionMath`: a polar re-radius of the instanced lattice.
 *
 * ponytail: `select`, not `If`. `warp == 1` is the identity and most surfaces
 * leave it there, so the GLSL guarded the whole thing behind a branch — but it
 * is a uniform branch over four cheap ops, and a select keeps the graph
 * straight-line on both backends. `r` is floored away from zero because the
 * unselected branch is still evaluated, and `atan(0, 0)` is not worth relying
 * on across two shading languages.
 */
function warpedGrid(warp: AsciiFieldUniforms["warp"]) {
  const aPosition = attribute<"vec3">("aPosition", "vec3");
  const grid = aPosition.xy.toVar();
  const safe = max(grid.length(), 1e-6);
  const theta = atan(grid.y, grid.x);
  const warped = pow(safe, warp).mul(vec2(cos(theta), sin(theta)));
  return vec3(select(warp.equal(1), grid, warped), aPosition.z);
}

/**
 * A material drawing one glyph per instance of the grid built by `asciiGrid.ts`.
 *
 * The instanced attributes are read straight off the `InstancedBufferGeometry` —
 * `aPosition`, `aPixelUV`, `aRandom` — so the grid builder needs no changes.
 */
export function createAsciiFieldMaterial(
  uniforms = createAsciiFieldUniforms(),
) {
  const u = uniforms;
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthTest = false;
  material.depthWrite = false;
  material.side = DoubleSide;

  material.positionNode = positionLocal.add(warpedGrid(u.warp));

  material.fragmentNode = Fn(() => {
    const pixelUv = attribute<"vec2">("aPixelUV", "vec2");
    const random = attribute<"float">("aRandom", "float");
    const quadUv = uv();

    // 1 where no fluid is bound, so every other surface is untouched.
    const fluidMask = float(1).toVar();
    const dye = clamp(u.fluid.sample(screenUV).rgb.length(), 0, 1).toVar();
    const lo = u.fluidThreshold.sub(u.fluidSoft.mul(0.5)).toVar();
    // Clamped and centred on the threshold, the same cut the fluid display pass
    // makes, so glyphs land inside the trail rather than trailing off past its
    // edge. `fluidSoft` 0 is that cut exactly; above 0 it tightens the reveal to
    // the core of the trail instead.
    Discard(u.hasFluid.greaterThan(0.5).and(dye.lessThan(lo)));
    fluidMask.assign(
      select(
        u.hasFluid.greaterThan(0.5).and(u.fluidSoft.greaterThan(0.0001)),
        smoothstep(lo, u.fluidThreshold.add(u.fluidSoft.mul(0.5)), dye),
        1,
      ),
    );

    /**
     * ponytail: converted to sRGB here, where the WebGL era tagged the offscreen
     * render target `SRGBColorSpace` and let `WebGLRenderer` encode on write.
     * The node renderer always renders into a user render target in the
     * *working* colour space, so that tag stops doing anything — and every
     * midtone would pick a sparser glyph than the numbers in `asciiTuning.ts`
     * were tuned against. Doing it in the graph keeps those numbers meaningful.
     */
    const src = u.scene.sample(pixelUv).toVar();

    // The offscreen clear is transparent, so bare background draws no glyph at
    // all. That is what keeps the Process cards and the About plate see-through.
    Discard(src.a.lessThan(0.02));

    // Archive read the red channel off a greyscale portrait. A lit render is
    // not greyscale, so weight the channels; alpha fades cells the mesh clips.
    const lum = dot(asVec3(toSRGB(src.rgb)), LUMA)
      .mul(src.a)
      .toVar();
    /**
     * Value noise over the cell, scrolling with time.
     *
     * ponytail: written inline rather than as a TSL `Fn` or a module-level
     * helper. `Fn` emits a real shader function and earns that for anything
     * reused; this is one hash and the 2×2 lerp over it, evaluated once per
     * fragment. Inline it also needs no hand-written parameter types — the
     * `@types/three` node generics are precise enough that naming an
     * intermediate "a vec2 node" is harder than not naming it.
     */
    const st = pixelUv.mul(1000).add(u.time.mul(3)).toVar();
    const hash = (p: typeof st) =>
      fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453123));
    const cell = floor(st).toVar();
    const frac = fract(st).toVar();
    const h00 = hash(cell).toVar();
    const h10 = hash(cell.add(vec2(1, 0)).toVar()).toVar();
    const h01 = hash(cell.add(vec2(0, 1)).toVar()).toVar();
    const h11 = hash(cell.add(vec2(1, 1)).toVar()).toVar();
    const w = frac
      .mul(frac)
      .mul(float(3).sub(frac.mul(2)))
      .toVar();
    const n = mix(h00, h10, w.x)
      .add(h01.sub(h00).mul(w.y).mul(float(1).sub(w.x)))
      .add(h11.sub(h10).mul(w.x).mul(w.y))
      .toVar();

    // `charNoise` walks the glyph index so cells shuffle character, not just
    // alpha.
    const brightness = clamp(
      pow(lum, u.gamma)
        .add(random.mul(u.jitter))
        .add(n.sub(0.5).mul(u.charNoise)),
      0,
      0.99,
    ).toVar();
    const index = floor(brightness.mul(u.glyphCount)).toVar();

    // Above 1 the glyph is cropped in rather than shrunk, which fills the cell
    // and reads denser; below 1 it shrinks and the surround has to drop out.
    const glyphCell = clamp(quadUv, 0, 1)
      .sub(0.5)
      .div(max(u.glyphScale, 0.05))
      .add(0.5)
      .toVar();
    Discard(glyphCell.x.lessThan(0).or(glyphCell.x.greaterThan(1)));
    Discard(glyphCell.y.lessThan(0).or(glyphCell.y.greaterThan(1)));

    const column = float(0.5).add(glyphCell.x.sub(0.5).mul(CELL_INSET));
    const atlasUv = vec2(column.add(index).div(u.glyphCount), glyphCell.y);
    const chr = u.atlas.sample(atlasUv).a.toVar();

    const flicker = mix(
      1,
      mix(0.7, 1.15, smoothstep(0.5, 1, n)),
      u.noise,
    ).toVar();

    const alpha = chr.mul(flicker).toVar();
    // Cull the glyph's empty parts before `opaqueGlyphs` promotes what is left
    // to solid ink. Promoting first fills the whole cell — every character
    // becomes a block, which is what the footer wordmark turned into.
    Discard(alpha.lessThan(0.01));
    alpha.assign(select(u.opaqueGlyphs.greaterThan(0.5), 1, alpha));
    alpha.assign(alpha.mul(fluidMask).mul(u.opacity));
    Discard(alpha.lessThan(0.01));

    const hi = select(
      u.hasHighlight.greaterThan(0.5),
      u.highlight.sample(pixelUv).r,
      0,
    );
    return vec4(mix(u.color, u.highlightColor, hi), alpha);
  })();

  return { material, uniforms: u };
}

/** Wrap the shared glyph bake in a texture for this renderer. */
export function atlasTexture(canvas: HTMLCanvasElement): Texture {
  const tex = new CanvasTexture(canvas);
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export { CELL_INSET };
