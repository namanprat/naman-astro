/**
 * The hero wordmark, rendered inside the WebGL scene so the glass above it has
 * something to refract — `MeshTransmissionMaterial` samples the scene into an
 * FBO, and the DOM is not in it. The lockup in `Menu.css` stays in the document
 * for layout and the accessible name; `html.is-hero-webgl` stops it painting.
 *
 * The melt comes with it. `heroIntro.ts` still owns the timing and emits cues;
 * this reproduces the two-stage CSS chain — `blur(Rpx)` then the alpha cut from
 * `GooeyFilter.astro` — as one fragment shader.
 *
 * ponytail: the blur is a 25-tap disc read off a mip level rather than a real
 * two-pass gaussian. The mark blurs by 0.45em of its own height, which is a
 * ~150px radius on a desktop lockup — far past what a sane tap count reaches on
 * its own. Letting the mip do the wide half and the taps the fine half costs one
 * material and no render targets. Upgrade path if it ever reads blocky: a
 * separable two-pass blur into a ping-pong FBO, run only while the cue is
 * `play`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { subscribeWordmark, type WordmarkCue } from "@/lib/site/heroIntro";
import { useThemeInk } from "@/lib/site/ascii/useThemeInk";
import { getGlassTuning } from "@/lib/site/hero/glassTuning";
import {
  createWordmarkTexture,
  MARK_ASPECT,
  TEXTURE_PAD,
  type WordmarkTexture,
} from "@/lib/site/hero/wordmarkTexture";

/** The DOM box the plane tracks. */
const LOCKUP = ".name_hero_lockup";
/** Its parent's padding is `--hero-chrome-pad`, so its box moves when the pad does. */
const CHROME = ".name_hero";

/** Resize-drag debounce. Only the re-raster waits; the first one is immediate. */
const RERASTER_DEBOUNCE_MS = 150;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Compiled as `#version 300 es` even without `glslVersion: GLSL3` — three does
 * that for every non-raw ShaderMaterial — so `textureLod` is available while
 * `varying`, `gl_FragColor` and `linearToOutputTexel` still come from three's
 * own prefix. Naming GLSL3 explicitly would take `gl_FragColor` away and break
 * `<colorspace_fragment>` with it.
 */
const FRAGMENT = /* glsl */ `
  varying vec2 vUv;

  uniform sampler2D uMap;
  uniform vec3 uColor;
  /** Gaussian sigma, in UV units on each axis. */
  uniform vec2 uSigma;
  /** Mip level the taps read from — the wide half of the kernel. */
  uniform float uLod;
  /** Alpha cut. 0 disables it (soft mode, and every width below the melt's). */
  uniform float uCut;
  /** Half-width of the cut at full blur. */
  uniform float uAA;
  /** 1 at the start of the melt, 0 once it has resolved. */
  uniform float uProgress;

  #define RING_TAPS 8
  #define RINGS 3
  /** Ring spacing, in sigma. Three rings reach 2 sigma — ~95% of the mass. */
  #define RING_STEP 0.6667

  float meltAlpha() {
    if (uSigma.x <= 0.0) return textureLod(uMap, vUv, 0.0).a;

    float sum = textureLod(uMap, vUv, uLod).a;
    float wsum = 1.0;

    for (int r = 0; r < RINGS; r++) {
      float radius = (float(r) + 1.0) * RING_STEP;
      float w = exp(-0.5 * radius * radius);
      // Half-step each ring so they do not stack on the same spokes.
      float phase = float(r) * (3.1415927 / float(RING_TAPS));
      for (int i = 0; i < RING_TAPS; i++) {
        float a = float(i) * (6.2831853 / float(RING_TAPS)) + phase;
        vec2 off = vec2(cos(a), sin(a)) * radius * uSigma;
        sum += textureLod(uMap, vUv + off, uLod).a * w;
        wsum += w;
      }
    }
    return sum / wsum;
  }

  void main() {
    float a = meltAlpha();

    if (uCut > 0.0) {
      // The cut's soft edge opens back up as the blur closes, so the mark lands
      // on the texture's own antialiasing instead of on a hard step.
      float aa = mix(0.5, uAA, clamp(uProgress, 0.0, 1.0));
      a = smoothstep(uCut - aa, uCut + aa, a);
    }

    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

/** CSS-pixel box of the lockup, relative to the canvas. */
type Placement = {
  centerX: number;
  centerY: number;
  markWidth: number;
};

function measure(canvas: HTMLCanvasElement): Placement | null {
  const lockup = document.querySelector<HTMLElement>(LOCKUP);
  if (!lockup) return null;
  const rect = lockup.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const host = canvas.getBoundingClientRect();
  return {
    centerX: rect.left + rect.width / 2 - host.left - host.width / 2,
    centerY: rect.top + rect.height / 2 - host.top - host.height / 2,
    markWidth: rect.width,
  };
}

export default function HeroWordmark() {
  const gl = useThree((state) => state.gl);
  const viewport = useThree((state) => state.viewport);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useThemeInk("#e2e2dd");
  /** Parsed once per theme change rather than once per frame. */
  const inkColor = useMemo(() => new THREE.Color(ink), [ink]);

  const [placement, setPlacement] = useState<Placement | null>(null);
  const [raster, setRaster] = useState<WordmarkTexture | null>(null);

  /* ── Track the DOM lockup ─────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = gl.domElement;
    const apply = () => {
      const next = measure(canvas);
      if (!next) return;
      setPlacement((prev) =>
        prev &&
        Math.abs(prev.centerX - next.centerX) < 0.5 &&
        Math.abs(prev.centerY - next.centerY) < 0.5 &&
        Math.abs(prev.markWidth - next.markWidth) < 0.5
          ? prev
          : next,
      );
    };
    apply();

    // The lockup's own box covers width changes; `.name_hero`'s covers the
    // `--hero-chrome-pad` recentring, which moves the mark without resizing it.
    const observer = new ResizeObserver(apply);
    for (const selector of [LOCKUP, CHROME]) {
      const el = document.querySelector(selector);
      if (el) observer.observe(el);
    }
    observer.observe(canvas);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [gl]);

  /* ── Rasterise at the measured width ──────────────────────────────────── */
  const markWidth = placement ? Math.round(placement.markWidth) : 0;
  /** First raster is immediate; a resize drag is what the debounce is for. */
  const hasRastered = useRef(false);
  useEffect(() => {
    if (!markWidth) return;
    let stale = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const rasterise = () => {
      void createWordmarkTexture(markWidth, dpr).then(
        (next) => {
          if (stale) {
            next.texture.dispose();
            return;
          }
          hasRastered.current = true;
          setRaster(next);
          invalidate();
        },
        () => {
          /* The SVG failed to load; the DOM lockup is still in the document. */
        },
      );
    };

    if (!hasRastered.current) {
      rasterise();
      return () => {
        stale = true;
      };
    }

    const timer = window.setTimeout(rasterise, RERASTER_DEBOUNCE_MS);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [markWidth, invalidate]);

  // Runs on the swap as well as on unmount, so the outgoing raster is the one
  // freed — `setRaster` above deliberately does not dispose.
  useEffect(() => () => raster?.texture.dispose(), [raster]);

  /* ── Melt state ───────────────────────────────────────────────────────── */
  /** GSAP tweens `blurPx` here; `useFrame` derives the uniforms from it. */
  const melt = useRef({ blurPx: 0, startPx: 0, cut: 0 });
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uMap: { value: null as THREE.Texture | null },
      uColor: { value: new THREE.Color("#e2e2dd") },
      uSigma: { value: new THREE.Vector2() },
      uLod: { value: 0 },
      uCut: { value: 0 },
      uAA: { value: 0.06 },
      uProgress: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    let tween: gsap.core.Tween | null = null;

    const unsubscribe = subscribeWordmark((cue: WordmarkCue) => {
      tween?.kill();
      tween = null;

      if (cue.kind === "settle") {
        melt.current = { blurPx: 0, startPx: 0, cut: 0 };
        invalidate();
        return;
      }

      const cut = cue.threshold ? getGlassTuning().melt.threshold : 0;
      melt.current = { blurPx: cue.blurPx, startPx: cue.blurPx, cut };

      if (cue.kind === "park") {
        invalidate();
        return;
      }

      tween = gsap.to(melt.current, {
        blurPx: 0,
        duration: cue.duration,
        ease: "power3.out",
        onUpdate: invalidate,
      });
      // The canvas is a lazy chunk behind a GLB fetch, so this cue can arrive
      // mid-melt. Seek rather than restart.
      tween.time((performance.now() - cue.startedAt) / 1000);
    });

    return () => {
      tween?.kill();
      unsubscribe();
    };
  }, [invalidate]);

  /**
   * Every uniform write goes through the mounted material, never through the
   * memoized object handed to the `uniforms` prop. R3F does not guarantee the
   * material keeps that exact object, and when it does not, mutating it writes
   * into a detached copy — which is a sampler that stays null and a mark that
   * renders as three's 1×1 transparent placeholder.
   */
  useFrame(() => {
    const u = material.current?.uniforms;
    if (!u) return;
    const { blurPx, startPx, cut } = melt.current;
    const tuning = getGlassTuning().melt;

    u.uMap.value = raster?.texture ?? null;
    u.uColor.value.copy(inkColor);
    u.uCut.value = cut;
    u.uAA.value = tuning.aa;
    u.uProgress.value = startPx > 0 ? blurPx / startPx : 0;

    if (!raster || blurPx <= 0) {
      u.uSigma.value.set(0, 0);
      u.uLod.value = 0;
      return;
    }

    const sigmaTexels = blurPx * raster.pixelRatio;
    u.uSigma.value.set(sigmaTexels / raster.width, sigmaTexels / raster.height);
    // Each mip level box-filters 2^L texels. Matching that to the ring spacing
    // (0.667 sigma) makes the boxes just overlap, which is what turns 25 taps
    // into one smooth kernel instead of 25 blocks.
    u.uLod.value = Math.log2(Math.max(sigmaTexels * 0.6 * tuning.lodScale, 1));
  });

  // Under `frameloop: demand` (reduced motion) nothing above runs on its own.
  useEffect(() => {
    invalidate();
  }, [raster, ink, invalidate]);

  if (!placement || !raster) return null;

  // Plane covers the mark plus the texture's transparent margin, so the melt's
  // halo has somewhere to spread instead of clipping at the glyph box.
  const markHeight = placement.markWidth / MARK_ASPECT;
  const pad = markHeight * TEXTURE_PAD;
  const { factor } = viewport;

  return (
    <mesh
      position={[placement.centerX / factor, -placement.centerY / factor, 0]}
      scale={[
        (placement.markWidth + pad * 2) / factor,
        (markHeight + pad * 2) / factor,
        1,
      ]}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
