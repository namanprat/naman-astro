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
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

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

/**
 * Brush, in cells. A fat disk every pointer sample (radius 22) filled ~1500
 * cells and scanned the whole lattice every frame, so the canvas hitch made
 * the trail look slow and gappy. A smaller falloff disk, stamped along the
 * pointer path each frame, reads as a thicker ribbon than the old 10-cell
 * random walk without stalling the loop. Same density as the Team lattice
 * (~183 rows): radius 7 is ~4% of the short axis.
 */
const BRUSH_RADIUS = 7;
/** Fade window. Binary on/off at 1.1s felt sticky; this matches the fluid's
 *  dissipation beat more closely. */
const LIFE_MS = 720;
/** Cap interpolated stamps so a huge pointer jump cannot hitch a frame. */
const MAX_STROKE_STEPS = 48;
/** px of scroll velocity → 0–1 of a sweep across the grid. */
const SCROLL_TRAIL_SCALE = 0.00022;

const blankHighlight = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
})();

function markCell(
  until: Float32Array,
  live: number[],
  index: number,
  expires: number,
  now: number,
): void {
  if (expires <= until[index]) return;
  if (until[index] <= now) live.push(index);
  until[index] = expires;
}

/** Soft disk: centre stays lit for `LIFE_MS`, the rim dies sooner. */
function stampDisk(
  until: Float32Array,
  live: number[],
  cols: number,
  rows: number,
  startCol: number,
  startRow: number,
  now: number,
): void {
  const radius2 = BRUSH_RADIUS * BRUSH_RADIUS;
  const radius = BRUSH_RADIUS;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > radius2) continue;
      const nc = startCol + dx;
      const nr = startRow + dy;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const fall = 1 - Math.sqrt(d2) / (radius + 0.001);
      markCell(
        until,
        live,
        nr * cols + nc,
        now + LIFE_MS * (0.35 + 0.65 * fall),
        now,
      );
    }
  }
}

/** NDC segment → cell stamps, so a fast move is a stroke not a dotted line. */
function stampSegment(
  until: Float32Array,
  live: number[],
  cols: number,
  rows: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  now: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot((dx * cols) / 2, (dy * rows) / 2);
  const steps = Math.min(MAX_STROKE_STEPS, Math.max(1, Math.ceil(dist)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const col = Math.floor(((x0 + dx * t + 1) / 2) * cols);
    const row = Math.floor(((y0 + dy * t + 1) / 2) * rows);
    if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
    stampDisk(until, live, cols, rows, col, row, now);
  }
}

function writeLiveCells(
  until: Float32Array,
  live: number[],
  pixels: Uint8Array,
  now: number,
): boolean {
  let dirty = false;
  let write = 0;
  for (let r = 0; r < live.length; r++) {
    const i = live[r];
    const remain = until[i] - now;
    if (remain <= 0) {
      until[i] = 0;
      const p = i * 4;
      if (pixels[p] !== 0) {
        pixels[p] = 0;
        pixels[p + 1] = 0;
        pixels[p + 2] = 0;
        pixels[p + 3] = 255;
        dirty = true;
      }
      continue;
    }
    live[write++] = i;
    const v =
      remain >= LIFE_MS
        ? 255
        : Math.max(1, Math.round((remain / LIFE_MS) * 255));
    const p = i * 4;
    if (pixels[p] !== v) {
      pixels[p] = v;
      pixels[p + 1] = v;
      pixels[p + 2] = v;
      pixels[p + 3] = 255;
      dirty = true;
    }
  }
  live.length = write;
  return dirty;
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
      uCharNoise: { value: 0 },
    }),
    // Tuning is re-pushed every frame; only the texture binding is fixed here.
    [target],
  );

  useEffect(() => {
    const color = shaderColor(ink);
    uniforms.uColor.value.copy(color);
    const material = materialRef.current;
    if (material) material.uniforms.uColor.value.copy(color);
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

  const trailOn = Boolean(hoverHighlight) && !reducedMotion;
  const hoveringRef = useRef(false);
  const pointerNdc = useRef({ x: 0, y: 0 });
  const lastStamp = useRef<{ x: number; y: number } | null>(null);
  const lastR3f = useRef<{ x: number; y: number } | null>(null);
  const highlightUntil = useRef<Float32Array>(new Float32Array(0));
  const highlightPixels = useRef<Uint8Array>(new Uint8Array(4));
  const liveCells = useRef<number[]>([]);
  const scrollSweep = useRef(0);
  const scrollVel = useRef(0);

  const highlightTex = useMemo(() => {
    const data = new Uint8Array(grid.cols * grid.rows * 4);
    highlightPixels.current = data;
    highlightUntil.current = new Float32Array(grid.cols * grid.rows);
    liveCells.current = [];
    lastStamp.current = null;
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
    uniforms.uHighlight.value = trailOn ? highlightTex : blankHighlight;
    uniforms.uHasHighlight.value = trailOn ? 1 : 0;
  }, [uniforms, trailOn, highlightTex]);

  useEffect(() => {
    if (!trailOn) return;
    const el = (events.connected as HTMLElement | null) ?? gl.domElement;

    const contains = (clientX: number, clientY: number) => {
      const box = el.getBoundingClientRect();
      return (
        clientX >= box.left &&
        clientX <= box.right &&
        clientY >= box.top &&
        clientY <= box.bottom
      );
    };

    const writeNdc = (clientX: number, clientY: number) => {
      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return;
      pointerNdc.current = {
        x: ((clientX - box.left) / box.width) * 2 - 1,
        y: 1 - ((clientY - box.top) / box.height) * 2,
      };
    };

    const onMove = (event: MouseEvent) => {
      const inside = contains(event.clientX, event.clientY);
      if (!inside && !hoveringRef.current) return;
      hoveringRef.current = inside;
      if (inside) writeNdc(event.clientX, event.clientY);
    };
    const onDown = (event: PointerEvent) => {
      if (!contains(event.clientX, event.clientY)) return;
      hoveringRef.current = true;
      writeNdc(event.clientX, event.clientY);
      lastStamp.current = null;
    };
    const onEnter = () => {
      hoveringRef.current = true;
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") hoveringRef.current = false;
    };
    const onLeave = () => {
      hoveringRef.current = false;
      lastStamp.current = null;
    };

    /* pointermove *and* mousemove: some drivers only fire one, and the
       homepage fluid listens on window for the same reason. */
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      hoveringRef.current = false;
      lastStamp.current = null;
    };
  }, [trailOn, gl, events]);

  useEffect(() => {
    if (!trailOn) return;
    const panel = gl.domElement.closest(".about_panel_scroll");
    const scroller =
      panel instanceof HTMLElement &&
      panel.scrollHeight > panel.clientHeight + 1
        ? panel
        : undefined;
    const st = ScrollTrigger.create({
      scroller,
      start: 0,
      end: "max",
      onUpdate(self) {
        const v = self.getVelocity();
        if (!v) return;
        scrollVel.current += v;
      },
    });
    return () => {
      st.kill();
    };
  }, [trailOn, gl]);

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
      if (trailOn) {
        u.uHasHighlight.value = 1;
        u.uHighlight.value = highlightTex;
      }
    }

    if (trailOn) {
      const now = performance.now();
      const { cols, rows } = grid;
      const until = highlightUntil.current;
      const pixels = highlightPixels.current;
      const live = liveCells.current;

      let r3fMoved = false;
      if (!lastR3f.current) {
        lastR3f.current = { x: pointer.x, y: pointer.y };
      } else if (
        lastR3f.current.x !== pointer.x ||
        lastR3f.current.y !== pointer.y
      ) {
        lastR3f.current = { x: pointer.x, y: pointer.y };
        r3fMoved = true;
      }

      if (hoveringRef.current || r3fMoved) {
        const px = pointer.x;
        const py = pointer.y;
        const prev = lastStamp.current;
        if (!prev) {
          const col = Math.floor(((px + 1) / 2) * cols);
          const row = Math.floor(((py + 1) / 2) * rows);
          if (col >= 0 && row >= 0 && col < cols && row < rows) {
            stampDisk(until, live, cols, rows, col, row, now);
          }
          lastStamp.current = { x: px, y: py };
        } else if (prev.x !== px || prev.y !== py) {
          stampSegment(until, live, cols, rows, prev.x, prev.y, px, py, now);
          lastStamp.current = { x: px, y: py };
        }
      }

      const vel = scrollVel.current;
      if (vel !== 0) {
        scrollVel.current = 0;
        const from = scrollSweep.current;
        const to = from + vel * SCROLL_TRAIL_SCALE;
        scrollSweep.current = ((to % 1) + 1) % 1;
        const dist = Math.abs(to - from) * Math.max(cols, rows);
        const steps = Math.min(MAX_STROKE_STEPS, Math.max(1, Math.ceil(dist)));
        for (let i = 1; i <= steps; i++) {
          const s = (((from + ((to - from) * i) / steps) % 1) + 1) % 1;
          const col = Math.floor(
            (0.3 + 0.4 * Math.sin(s * Math.PI * 2)) * cols,
          );
          const row = Math.floor((0.2 + 0.6 * s) * rows);
          if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
          stampDisk(until, live, cols, rows, col, row, now);
        }
      }

      if (writeLiveCells(until, live, pixels, now)) {
        highlightTex.needsUpdate = true;
      }
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
