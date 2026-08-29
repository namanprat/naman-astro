/**
 * Fluid-masked ASCII twin of the hero glass.
 *
 * Three things stack on top of the glass, in this order: the raw dye painted as
 * grey over it, then a glyph grid that only draws where that dye is, sampling an
 * offscreen matte of the same logo. The liquid is the mask — sweep the pointer
 * across the mark and the glass gives way to characters under the trail.
 *
 * The matte is not a clone. This component mounts inside `HeroLogoShell`'s scale
 * group, so a mesh it renders already carries the spin and the fit; putting that
 * mesh on its own layer and flipping `camera.layers` for one pass renders the
 * logo alone, through the page camera, with nothing to keep in sync. A cloned
 * object copying transforms every frame was the previous shape and it is exactly
 * one ordering mistake away from shearing off the glass.
 *
 * The grid rides `useCameraOverlay`, which makes a cell's slot the same thing as
 * a screen pixel — which is what `vPixelUV` means to `ASCII_FIELD_FRAG`, and the
 * only reason it can index a matte drawn in screen space.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { readCssColor, shaderColor } from "@/lib/site/cssColor";
import { SWATCH_DARK } from "@/lib/site/siteColors";
import { useThemeInk, useThemeLight } from "@/lib/site/ascii/useThemeInk";
import { getDufornAsciiAtlas } from "@/lib/site/ascii/asciiAtlas";
import { buildAsciiGrid } from "@/lib/site/ascii/asciiGrid";
import {
  ASCII_FIELD_FRAG,
  ASCII_FIELD_VERT,
} from "@/lib/site/ascii/asciiFieldShader";
import { ensureAsciiGui } from "@/lib/site/ascii/asciiGui";
import {
  getAsciiTuning,
  subscribeAsciiTuning,
} from "@/lib/site/ascii/asciiTuning";
import { getGlassTuning } from "@/lib/site/hero/glassTuning";
import { useCameraOverlay } from "@/lib/site/cameraOverlay";
import { useFluidSimStateRef } from "@/lib/site/fluid/fluidSimContext";
import { useHeroLogo } from "./HeroLogoShell";

/** The matte's own layer. Layer 0 is the page. */
const ASCII_LAYER = 1;

/* Live from the Glass panel's `reveal` folder — the mask and the weight of the
 * two layers it gates. The glyphs' own look is the ASCII panel's `hero` folder,
 * which owns that lattice for every surface on the site. */

type HeroAsciiRevealProps = {
  /**
   * False to draw every glyph the matte reaches, rather than only the ones the
   * liquid is over. The phone has no trail to mask with — the sim ignores
   * pointer input at that width — so the mark is the ASCII, not a reveal of it.
   */
  masked?: boolean;
};

export default function HeroAsciiReveal({
  masked = true,
}: HeroAsciiRevealProps) {
  const { fitted } = useHeroLogo();
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const size = useThree((state) => state.size);
  const fluid = useFluidSimStateRef();
  /* `useThemeLight` is already subscribed to the theme class, so it doubles as
     the signal to re-read the token. */
  const themeLight = useThemeLight();
  const ink = useThemeInk("#e2e2dd");
  const glyph = useMemo(
    () =>
      /* Masked, the glyphs stand inside the trail, which writes white for the
         difference blend — so they take the page's surface token, the one
         colour that survives that inversion on both themes. Unmasked there is
         no liquid under them, because they *are* the mark, so they take the
         page's ink instead. `--dark` there would be black on black. */
      masked
        ? shaderColor(readCssColor("--dark", SWATCH_DARK))
        : shaderColor(ink),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeLight, masked, ink],
  );

  const gridMaterial = useRef<THREE.ShaderMaterial>(null);

  const tuning = useMemo(() => getAsciiTuning("hero"), []);
  const [density, setDensity] = useState(tuning.density);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void ensureAsciiGui("hero");
    return subscribeAsciiTuning("hero", () => setDensity(tuning.density));
  }, [tuning]);

  /** Renders on its own layer only — see the note at the top. */
  const matteLayers = useMemo(() => {
    const layers = new THREE.Layers();
    layers.set(ASCII_LAYER);
    return layers;
  }, []);

  const target = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    /* sRGB, same reasoning as `AsciiField`: the glyph shader reads the texel raw
       and needs display-referred values or every midtone picks too sparse a
       glyph. */
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    return rt;
  }, []);
  useEffect(() => () => target.dispose(), [target]);

  const aspect = size.width / Math.max(size.height, 1);
  const grid = useMemo(
    () => buildAsciiGrid(density, aspect),
    [density, aspect],
  );
  useEffect(() => () => grid.geometry.dispose(), [grid]);

  /** Shared with the fluid trail, so the glyphs and the liquid they stand in
   *  are placed by one piece of code and cannot drift apart. */
  const overlay = useCameraOverlay();

  /** Frame scratch, so the matte pass allocates nothing. */
  const scratch = useMemo(
    () => ({
      color: new THREE.Color(),
      size: new THREE.Vector2(),
    }),
    [],
  );

  const uniforms = useMemo(
    () => ({
      uScene: { value: target.texture },
      uAtlas: { value: null as THREE.Texture | null },
      uHighlight: { value: null as THREE.Texture | null },
      uGlyphCount: { value: 1 },
      uColor: { value: glyph.clone() },
      uHighlightColor: { value: glyph.clone() },
      uHasHighlight: { value: 0 },
      uWarp: { value: tuning.warp },
      uGamma: { value: tuning.gamma },
      uGlyphScale: { value: tuning.glyphScale },
      uJitter: { value: tuning.jitter },
      uTime: { value: 0 },
      uNoise: { value: tuning.noise },
      uCharNoise: { value: 0 },
      uOpaqueGlyphs: { value: 0 },
      uFluid: { value: null as THREE.Texture | null },
      uHasFluid: { value: 0 },
      uFluidThreshold: { value: 1 },
      uFluidSoft: { value: 1 },
      uOpacity: { value: 1 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    }),
    // Tuning is re-pushed every frame; only the texture binding is fixed here.
    [target],
  );

  useEffect(() => {
    let disposed = false;
    let texture: THREE.CanvasTexture | null = null;
    getDufornAsciiAtlas()
      .then((atlas) => {
        if (disposed) {
          atlas.texture.dispose();
          return;
        }
        texture = atlas.texture;
        uniforms.uAtlas.value = texture;
        uniforms.uGlyphCount.value = atlas.glyphCount;
        setReady(true);
      })
      .catch(() => {
        /* The glass remains intact if the decorative atlas cannot load. */
      });
    return () => {
      disposed = true;
      texture?.dispose();
    };
  }, [uniforms]);

  /*
   * The matte pass. Same scene, same camera, same projection offset as the frame
   * about to be drawn — only the layer differs, so the render lands pixel-on-
   * pixel with the glass. Negative priority keeps R3F's automatic render (only
   * `priority > 0` takes that away) while running ahead of it.
   */
  useFrame((state) => {
    const drawSize = state.gl.getDrawingBufferSize(scratch.size);
    if (target.width !== drawSize.x || target.height !== drawSize.y) {
      target.setSize(drawSize.x, drawSize.y);
    }

    /* Everything touched here is shared with the frame about to be drawn, so
       everything has to go back. Leaving the clear alpha at 0 costs the page its
       glass outright — the transmission material's own buffer then clears
       transparent and the mesh drops out of the frame. */
    const background = state.scene.background;
    const previousTarget = state.gl.getRenderTarget();
    const previousAlpha = state.gl.getClearAlpha();
    state.gl.getClearColor(scratch.color);

    /* The backdrop is the fluid plate and would fill the target, after which
       every cell clears the shader's `src.a` test and glyphs cover the screen. */
    state.scene.background = null;
    state.camera.layers.set(ASCII_LAYER);
    state.gl.setRenderTarget(target);
    state.gl.setClearColor(0x000000, 0);
    state.gl.clear(true, true, true);
    state.gl.render(state.scene, state.camera);

    state.camera.layers.set(0);
    state.scene.background = background;
    state.gl.setClearColor(scratch.color, previousAlpha);
    state.gl.setRenderTarget(previousTarget);
  }, -1);

  useFrame((state, delta) => {
    const dye = fluid.current.dye;
    const { reveal } = getGlassTuning();
    const resolution = state.gl.getDrawingBufferSize(scratch.size);

    const material = gridMaterial.current;
    if (!material) return;
    const u = material.uniforms;
    u.uColor.value.copy(glyph);
    u.uHighlightColor.value.copy(glyph);
    u.uWarp.value = tuning.warp;
    u.uGamma.value = tuning.gamma;
    u.uGlyphScale.value = tuning.glyphScale;
    u.uJitter.value = tuning.jitter;
    u.uNoise.value = tuning.noise;
    u.uTime.value += delta;
    u.uFluid.value = dye;
    u.uHasFluid.value = masked && dye ? 1 : 0;
    u.uFluidThreshold.value = reveal.maskThreshold;
    u.uFluidSoft.value = reveal.maskSoftness;
    u.uOpacity.value = reveal.glyphOpacity;
    u.uResolution.value.copy(resolution);
  });

  if (!fitted) return null;

  return (
    <>
      {/* Sibling of the glass mesh inside the shell's scale group, so it needs
          no transform of its own. Normals give the glyph lookup a brightness
          ramp that tracks the form, and cost no lights. */}
      <mesh geometry={fitted.geo} layers={matteLayers}>
        <meshNormalMaterial />
      </mesh>

      {createPortal(
        <>
          {ready && (
            <mesh
              renderOrder={11}
              frustumCulled={false}
              geometry={grid.geometry}
            >
              <shaderMaterial
                ref={gridMaterial}
                uniforms={uniforms}
                vertexShader={ASCII_FIELD_VERT}
                fragmentShader={ASCII_FIELD_FRAG}
                transparent
                depthTest={false}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          )}
        </>,
        overlay,
      )}
    </>
  );
}
