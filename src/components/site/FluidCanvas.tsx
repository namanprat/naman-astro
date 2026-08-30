/**
 * The site backdrop, and — on home — the hero glass with it.
 *
 * One WebGL context for both. `FluidSimulation` renders its display pass into a
 * render target instead of the screen, that target is the scene's `background`,
 * and three draws it full-screen behind everything. The hero's
 * `MeshTransmissionMaterial` refracts `scene.background`, so the glass picks up
 * the live sim for free — which a second context could only have managed with a
 * per-frame GPU readback.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import "./FluidCanvas.css";
import { FluidSimulation } from "@/lib/site/fluid/FluidSimulation";
import {
  FluidSimStateProvider,
  useFluidSimStateRef,
} from "@/lib/site/fluid/fluidSimContext";
import { MOBILE_LAYOUT_MQ } from "@/lib/site/isMobileLayout";
import { useCameraOverlay } from "@/lib/site/cameraOverlay";
import { readCssColor, shaderColor } from "@/lib/site/cssColor";
import { useThemeLight } from "@/lib/site/ascii/useThemeInk";
import { SWATCH_TRAIL } from "@/lib/site/siteColors";
import * as THREE from "three";

/**
 * The trail as it reaches the screen, with the display pass's own cut for its
 * alpha and transparent everywhere else — 0 being difference's identity. This is
 * Cappen's original arrangement, which the site had traded away when the hero
 * glass moved onto this canvas.
 *
 * It paints `--trail` flat — brand white on the dark theme, brand black on the
 * light one. The inversion is not done here: the copy that the trail should cut
 * through carries `mix-blend-mode: difference` itself, so the trail is simply
 * the colour it is meant to be and only the opted-in text reacts to it. See
 * `.is-trail-invert` in `FluidCanvas.css`.
 *
 * Work's grid punches this pass out of an HTML grey plate (`FluidCanvas.css`).
 * The wrap composites as `saturation`, so the plate drains the covers and the
 * liquid is a hole that lets the original colour through. The trail itself is
 * just an opaque stamp — invert-on-canvas was the Safari grey soup.
 */
const TRAIL_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uFluid;
uniform vec3 uColor;
uniform vec2 uResolution;
uniform float uThreshold;
uniform float uSoft;

void main() {
  float d = clamp(
    length(texture2D(uFluid, gl_FragCoord.xy / uResolution).rgb), 0.0, 1.0);
  float a = uSoft > 0.0
    ? smoothstep(uThreshold - uSoft * 0.5, uThreshold + uSoft * 0.5, d)
    : step(uThreshold, d);

  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

const TRAIL_VERT = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Above the glass — the trail lies on the logo, not behind it — and below the
 *  hero's glyph grid, which stands in the trail. */
const TRAIL_RENDER_ORDER = 10;

/** Grid view on `/work`: the 2D plate drains the covers. */
function workGridDrain(): boolean {
  const root = document.documentElement;
  return (
    root.classList.contains("work-grid") &&
    !root.classList.contains("work-project-open")
  );
}

function GridSatPlate({ host }: { host: HTMLDivElement | null }) {
  const plate = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const dest = plate.current;
    if (!host || !dest) return;
    let raf = 0;
    const tick = () => {
      const src = host.querySelector<HTMLCanvasElement>("canvas:not(.work_grid_plate)");
      if (src && dest && workGridDrain()) {
        if (dest.width !== src.width) dest.width = src.width;
        if (dest.height !== src.height) dest.height = src.height;
        const ctx = dest.getContext("2d");
        if (ctx) {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "#808080";
          ctx.fillRect(0, 0, dest.width, dest.height);
          ctx.globalCompositeOperation = "destination-out";
          ctx.drawImage(src, 0, 0);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [host]);

  return <canvas className="work_grid_plate" ref={plate} aria-hidden />;
}

function TrailOverlay() {
  const overlay = useCameraOverlay();
  const fluid = useFluidSimStateRef();
  const size = useThree((state) => state.size);
  const material = useRef<THREE.ShaderMaterial>(null);

  /* `useThemeLight` already subscribes to the theme class, so it doubles as the
     signal to re-read the token. */
  const themeLight = useThemeLight();
  const color = useMemo(
    () => shaderColor(readCssColor("--trail", SWATCH_TRAIL)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeLight],
  );

  const aspect = size.width / Math.max(size.height, 1);
  const uniforms = useMemo(
    () => ({
      uFluid: { value: null as THREE.Texture | null },
      uColor: { value: color.clone() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uThreshold: { value: 1 },
      uSoft: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state) => {
    const node = material.current;
    if (!node) return;
    node.uniforms.uFluid.value = fluid.current.dye;
    node.uniforms.uColor.value.copy(color);
    node.uniforms.uThreshold.value = fluid.current.threshold;
    node.uniforms.uSoft.value = fluid.current.edgeSoftness;
    state.gl.getDrawingBufferSize(node.uniforms.uResolution.value);
    node.visible = Boolean(fluid.current.dye);
  });

  return createPortal(
    <mesh renderOrder={TRAIL_RENDER_ORDER} frustumCulled={false}>
      <planeGeometry args={[2 * aspect, 2]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={TRAIL_VERT}
        fragmentShader={TRAIL_FRAG}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>,
    overlay,
  );
}

/**
 * Home only, and lazily: this island is on every route, while the hero pulls in
 * drei and a 300KB GLB behind it.
 */
const HeroGlass = lazy(() => import("./hero/HeroGlass"));

function useMediaFlag(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return matches;
}

/**
 * Can this browser give us a context at all?
 *
 * three throws outright when `getContext` returns null, and there is no error
 * boundary above this island, so an unprobed `<Canvas>` would take the page down
 * with it. Returning `false` leaves the wrap in place painting `--background`,
 * and the hero falls back to its DOM lockup — the mark is never what goes
 * missing.
 *
 * The probe is mounted inside the wrap, so anything selecting on
 * `.fluid_wrap canvas` (the WebGL stub in `tests/helpers.ts`, say) catches the
 * probe and the real canvas with one selector.
 */
function useWebglSupport(host: HTMLElement | null): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    if (!host) return;
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    host.appendChild(probe);
    let ok = false;
    try {
      ok = !!probe.getContext("webgl2");
    } catch {
      ok = false;
    }
    probe.remove();
    setSupported(ok);
  }, [host]);
  return supported;
}

/** The sim, driven by R3F's loop and wired to the scene's background slot. */
function FluidBackdrop() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const simulation = useRef<FluidSimulation | null>(null);
  const fluidState = useFluidSimStateRef();

  useEffect(() => {
    const sim = new FluidSimulation(gl);
    simulation.current = sim;
    fluidState.current = {
      dye: sim.dyeTexture,
      active: sim.dyeActive,
      threshold: sim.dyeThreshold,
      edgeSoftness: sim.dyeEdgeSoftness,
    };
    scene.background = null;
    /*
     * The plate is for `MeshTransmissionMaterial`'s buffer, not for the page.
     * A screen-pass plate is opaque, which kills both home's difference on
     * copy and work's saturation hole — discard would reveal the plate, not
     * a transparent identity. Target renders still get the plate to bend.
     */
    scene.onBeforeRender = (renderer) => {
      /* ASCII's matte pass also renders to a target. The plate would fill
         that buffer, every cell would pass `src.a`, and glyphs would paint
         the page colour behind the characters. `HeroAsciiReveal` sets this
         flag around that pass. */
      if (
        renderer.getRenderTarget() === null ||
        scene.userData.skipFluidPlate
      ) {
        scene.background = null;
        return;
      }
      const current = simulation.current;
      scene.background = current ? current.output.texture : null;
    };
    return () => {
      scene.onBeforeRender = () => {};
      scene.background = null;
      sim.dispose();
      simulation.current = null;
      fluidState.current = {
        dye: null,
        active: false,
        threshold: 1,
        edgeSoftness: 0,
      };
    };
  }, [gl, scene, fluidState]);

  useFrame((_, delta) => {
    const sim = simulation.current;
    if (!sim) return;
    /* Unbind before the sim writes. Even with a ping-ponged target, last
       frame's background plane still has that texture on a sampler. */
    scene.background = null;
    sim.update(delta);
    fluidState.current.dye = sim.dyeTexture;
    fluidState.current.active = sim.dyeActive;
    fluidState.current.threshold = sim.dyeThreshold;
    fluidState.current.edgeSoftness = sim.dyeEdgeSoftness;
  }, -1);
  return null;
}

export default function FluidCanvas() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const webgl = useWebglSupport(host);
  const mobile = useMediaFlag(MOBILE_LAYOUT_MQ);
  /* Hard navigation, no client router (`lib/site/pageTransition.ts`), so the
     island remounts per page and the path at mount is the path. */
  const [home] = useState(() => window.location.pathname === "/");

  return (
    <div className="fluid_wrap" data-fluid aria-hidden="true" ref={setHost}>
      {webgl === true && (
        <FluidSimStateProvider>
          <Canvas
            /* No tone curve. The wordmark in the scene has to match `var(--text)`
             in the DOM to the byte, and the backdrop has to match the CSS
             tokens it is built from; ACES on the way out breaks both. */
            flat
            dpr={mobile ? [1, 1.25] : [1, 1.75]}
            gl={{
              /* Transparent: the trail is the only thing that reaches the page,
                 and difference blending needs 0 for "leave this alone". */
              alpha: true,
              antialias: true,
              powerPreference: "high-performance",
              /* GridSatPlate drawImage-s this buffer after present. */
              preserveDrawingBuffer: true,
            }}
            camera={{ fov: 35, position: [0, 0, 5], near: 0.1, far: 50 }}
            style={{ pointerEvents: "none" }}
            /* The hero handles scroll itself, through the projection offset. */
            resize={{ scroll: false }}
          >
            <FluidBackdrop />
            <TrailOverlay />
            {home && (
              <Suspense fallback={null}>
                <HeroGlass mobile={mobile} />
              </Suspense>
            )}
          </Canvas>
        </FluidSimStateProvider>
      )}
      <GridSatPlate host={host} />
    </div>
  );
}
