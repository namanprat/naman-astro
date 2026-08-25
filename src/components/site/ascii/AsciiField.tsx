/**
 * The one ASCII pass on the site, ported from `Archive (1)`.
 *
 * Whatever is passed as `children` renders into an offscreen target through its
 * own camera; a grid of instanced quads then draws over the canvas, each cell
 * sampling one texel block of that render and stamping the Duforn glyph whose
 * ink matches its brightness. About's bust, the Team cylinder and the Process
 * card primitives all mount through here, so the treatment cannot drift apart
 * between them the way three hand-rolled shaders did.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import type { ReactNode } from "react";
import * as THREE from "three";
import { shaderColor } from "@/lib/site/cssColor";
import { FINE_HOVER_QUERY } from "@/lib/site/hasFinePointerHover";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { getDufornAsciiAtlas } from "@/lib/site/ascii/asciiAtlas";
import {
  ASCII_FIELD_FRAG,
  ASCII_FIELD_VERT,
} from "@/lib/site/ascii/asciiFieldShader";
import { ensureAsciiGui } from "@/lib/site/ascii/asciiGui";
import {
  getAsciiTuning,
  subscribeAsciiTuning,
  type AsciiSurface,
} from "@/lib/site/ascii/asciiTuning";

type AsciiFieldProps = {
  /** Which entry of `asciiTuning` drives the look, and which GUI folder. */
  surface: AsciiSurface;
  /** Glyph colour. A literal, not a token — see the per-surface notes. */
  ink: string;
  /** Accent for pointer cluster highlights. Omit to disable. */
  hoverHighlight?: string;
  /** Offscreen camera. Defaults frame a ~2-unit subject. */
  fov?: number;
  cameraPosition?: [number, number, number];
  near?: number;
  far?: number;
  children: ReactNode;
};

type Grid = {
  geometry: THREE.InstancedBufferGeometry;
  cols: number;
  rows: number;
};

const CLUSTER_SIZE = 10;
const HIGHLIGHT_LIFETIME = 300;

const blankHighlight = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
})();

function highlightCluster(
  until: Float32Array,
  cols: number,
  rows: number,
  startCol: number,
  startRow: number,
  now: number,
) {
  const key = (c: number, r: number) => r * cols + c;
  const start = key(startCol, startRow);
  until[start] = now + HIGHLIGHT_LIFETIME;
  const lit = [start];
  let col = startCol;
  let row = startRow;
  const steps = Math.floor(Math.random() * CLUSTER_SIZE) + 1;
  for (let step = 0; step < steps; step++) {
    const neighbours: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nc = col + dx;
        const nr = row + dy;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = key(nc, nr);
        if (!lit.includes(ni)) neighbours.push(ni);
      }
    }
    if (neighbours.length === 0) break;
    const next = neighbours[Math.floor(Math.random() * neighbours.length)];
    until[next] = now + HIGHLIGHT_LIFETIME + step * 10;
    lit.push(next);
    col = next % cols;
    row = Math.floor(next / cols);
  }
}

/** One instanced quad per cell, filling [-aspect, aspect] x [-1, 1]. */
function buildGrid(density: number, aspect: number): Grid {
  const rows = Math.max(2, Math.round(density));
  const cols = Math.max(2, Math.round(density * aspect));
  const cellW = (2 * aspect) / cols;
  const cellH = 2 / rows;
  const count = rows * cols;

  const positions = new Float32Array(count * 3);
  const pixelUv = new Float32Array(count * 2);
  const random = new Float32Array(count);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const index = i * rows + j;
      positions[index * 3] = -aspect + (i + 0.5) * cellW;
      positions[index * 3 + 1] = -1 + (j + 0.5) * cellH;
      positions[index * 3 + 2] = 0;
      pixelUv[index * 2] = (i + 0.5) / cols;
      pixelUv[index * 2 + 1] = (j + 0.5) / rows;
      // Archive's pow(random, 4) — biased low, so only a few cells jump a glyph.
      random[index] = Math.pow(Math.random(), 4);
    }
  }

  // ponytail: base is never rendered on its own and its attributes are handed
  // straight to the instanced geometry, so it must not be disposed here.
  const base = new THREE.PlaneGeometry(cellW, cellH, 1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.attributes.position);
  geometry.setAttribute("uv", base.attributes.uv);
  geometry.instanceCount = count;
  geometry.setAttribute(
    "aPosition",
    new THREE.InstancedBufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "aPixelUV",
    new THREE.InstancedBufferAttribute(pixelUv, 2),
  );
  geometry.setAttribute(
    "aRandom",
    new THREE.InstancedBufferAttribute(random, 1),
  );

  return { geometry, cols, rows };
}

export default function AsciiField({
  surface,
  ink,
  hoverHighlight,
  fov = 45,
  cameraPosition = [0, 0, 4],
  near = 0.1,
  far = 100,
  children,
}: AsciiFieldProps) {
  const { scene, size, pointer, gl, events } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [ready, setReady] = useState(false);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  // ponytail: the live object, mutated in place by the GUI. Only `density`
  // rebuilds anything, so that is the one value mirrored into React state; the
  // rest are read straight off it in the frame loop.
  const tuning = useMemo(() => getAsciiTuning(surface), [surface]);
  const [density, setDensity] = useState(tuning.density);

  useEffect(() => {
    void ensureAsciiGui(surface);
    return subscribeAsciiTuning(surface, () => setDensity(tuning.density));
  }, [surface, tuning]);

  const offscreen = useMemo(() => new THREE.Scene(), []);

  const offCamera = useMemo(
    () => new THREE.PerspectiveCamera(fov, 1, near, far),
    // Position is applied below so a moving camera doesn't rebuild the object.
    [fov, near, far],
  );

  const [camX, camY, camZ] = cameraPosition;
  useEffect(() => {
    // ponytail: destructured, not the array — a literal prop rebuilds every
    // render, and this must not fight a surface that drives the camera itself.
    offCamera.position.set(camX, camY, camZ);
    offCamera.updateProjectionMatrix();
  }, [offCamera, camX, camY, camZ]);

  /** The grid lives in NDC-ish units, so only aspect and density move it. */
  const aspect = size.width / Math.max(size.height, 1);
  const gridCamera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1),
    [],
  );
  const grid = useMemo(() => buildGrid(density, aspect), [density, aspect]);
  useEffect(() => () => grid.geometry.dispose(), [grid]);

  const target = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    // ponytail: sRGB here, not linear. The glyph shader reads the texel raw —
    // a raw ShaderMaterial gets no decode — so the offscreen pass has to hand
    // it display-referred values or every midtone picks too sparse a glyph.
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    return rt;
  }, []);

  useEffect(() => () => target.dispose(), [target]);

  const uniforms = useMemo(
    () => ({
      uScene: { value: target.texture },
      uAtlas: { value: null as THREE.Texture | null },
      uHighlight: { value: blankHighlight },
      uGlyphCount: { value: 1 },
      uColor: { value: shaderColor(ink) },
      uHighlightColor: { value: shaderColor(hoverHighlight ?? ink) },
      uHasHighlight: { value: 0 },
      uWarp: { value: tuning.warp },
      uGamma: { value: tuning.gamma },
      uGlyphScale: { value: tuning.glyphScale },
      uJitter: { value: tuning.jitter },
      uTime: { value: 0 },
      uNoise: { value: reducedMotion ? 0 : tuning.noise },
    }),
    // Tuning is re-pushed every frame; only the texture binding is fixed here.
    [target],
  );

  useEffect(() => {
    uniforms.uColor.value.copy(shaderColor(ink));
  }, [uniforms, ink]);

  useEffect(() => {
    uniforms.uHighlightColor.value.copy(shaderColor(hoverHighlight ?? ink));
  }, [uniforms, hoverHighlight, ink]);

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
        uniforms.uAtlas.value = atlas.texture;
        uniforms.uGlyphCount.value = atlas.glyphCount;
        setReady(true);
      })
      .catch(() => {
        /* No atlas — the surface stays empty; surrounding copy is unaffected. */
      });
    return () => {
      disposed = true;
      texture?.dispose();
    };
  }, [uniforms]);

  const hoverOn = Boolean(hoverHighlight) && !reducedMotion;
  const hoveringRef = useRef(false);
  const fineHoverRef = useRef(false);
  const lastPointer = useRef({ x: 999, y: 999 });
  const highlightUntil = useRef<Float32Array>(new Float32Array(0));
  const highlightPixels = useRef<Uint8Array>(new Uint8Array(4));

  const highlightTex = useMemo(() => {
    const data = new Uint8Array(grid.cols * grid.rows * 4);
    highlightPixels.current = data;
    highlightUntil.current = new Float32Array(grid.cols * grid.rows);
    const tex = new THREE.DataTexture(
      data,
      grid.cols,
      grid.rows,
      THREE.RGBAFormat,
    );
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, [grid]);

  useEffect(() => () => highlightTex.dispose(), [highlightTex]);

  useEffect(() => {
    uniforms.uHighlight.value = hoverOn ? highlightTex : blankHighlight;
    uniforms.uHasHighlight.value = hoverOn ? 1 : 0;
  }, [uniforms, hoverOn, highlightTex]);

  useEffect(() => {
    if (!hoverOn) return;
    const el = (events.connected as HTMLElement | null) ?? gl.domElement;
    const onEnter = () => {
      hoveringRef.current = true;
    };
    const onLeave = () => {
      hoveringRef.current = false;
    };
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      hoveringRef.current = false;
    };
  }, [hoverOn, gl, events]);

  useEffect(() => {
    if (!hoverOn) return;
    const mq = window.matchMedia(FINE_HOVER_QUERY);
    const sync = () => {
      fineHoverRef.current = mq.matches;
      if (!mq.matches) hoveringRef.current = false;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [hoverOn]);

  // ponytail: a non-zero priority takes R3F's automatic render away, so this
  // callback owns both passes — offscreen first, then the glyph grid to screen.
  useFrame((state, dt) => {
    const dpr = state.gl.getPixelRatio();
    const w = Math.max(1, Math.floor(state.size.width * dpr));
    const h = Math.max(1, Math.floor(state.size.height * dpr));
    if (target.width !== w || target.height !== h) target.setSize(w, h);

    offCamera.aspect = state.size.width / Math.max(state.size.height, 1);
    offCamera.updateProjectionMatrix();

    const nextAspect = offCamera.aspect;
    gridCamera.left = -nextAspect;
    gridCamera.right = nextAspect;
    gridCamera.updateProjectionMatrix();

    const material = materialRef.current;
    if (material) {
      const u = material.uniforms;
      u.uWarp.value = tuning.warp;
      u.uGamma.value = tuning.gamma;
      u.uGlyphScale.value = tuning.glyphScale;
      u.uJitter.value = tuning.jitter;
      u.uNoise.value = reducedMotion ? 0 : tuning.noise;
      if (!reducedMotion) u.uTime.value += dt;
    }

    if (hoverOn) {
      const now = performance.now();
      const { cols, rows } = grid;
      const until = highlightUntil.current;
      const pixels = highlightPixels.current;
      const fine = fineHoverRef.current;
      if (hoveringRef.current && fine) {
        if (
          pointer.x !== lastPointer.current.x ||
          pointer.y !== lastPointer.current.y
        ) {
          lastPointer.current = { x: pointer.x, y: pointer.y };
          const col = Math.floor(((pointer.x + 1) / 2) * cols);
          const row = Math.floor(((pointer.y + 1) / 2) * rows);
          if (col >= 0 && row >= 0 && col < cols && row < rows) {
            highlightCluster(until, cols, rows, col, row, now);
          }
        }
      }
      let dirty = false;
      for (let i = 0; i < until.length; i++) {
        const live = until[i] > now;
        const v = live ? 255 : 0;
        const p = i * 4;
        if (pixels[p] !== v) {
          pixels[p] = v;
          pixels[p + 1] = v;
          pixels[p + 2] = v;
          pixels[p + 3] = 255;
          dirty = true;
        }
      }
      if (dirty) highlightTex.needsUpdate = true;
    }

    state.gl.setRenderTarget(target);
    state.gl.clear();
    state.gl.render(offscreen, offCamera);
    state.gl.setRenderTarget(null);
    state.gl.render(scene, gridCamera);
  }, 1);

  return (
    <>
      {/* Camera goes in through the portal state so drei helpers in `children`
          — OrbitControls, Environment — bind to the offscreen pair with no
          per-surface wiring. */}
      {createPortal(children, offscreen, { camera: offCamera })}
      {ready && (
        <mesh frustumCulled={false} geometry={grid.geometry}>
          <shaderMaterial
            ref={materialRef}
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
    </>
  );
}
