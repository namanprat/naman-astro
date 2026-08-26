/**
 * The About bust, drawn in Duforn glyphs.
 *
 * This used to be a 4x4 ordered-dither post pass with a pointer-warp effect in
 * front of it. Both are gone: the lit bust now renders into `AsciiField`, the
 * same shared ASCII pass the Process cards and the Team cylinder go through.
 */
import {
  OrbitControls,
  Center,
  Environment,
  Lightformer,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Suspense,
  Component,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";
import AsciiField from "../ascii/AsciiField";
import {
  SWATCH_BRAND,
  SWATCH_LIGHT,
  SWATCH_LIGHT_NUM,
} from "@/lib/site/siteColors";
import { getAboutCanvasMaxDpr, BUST_URL } from "@/lib/site/aboutBust";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Same px/s → radians scale the Team cylinder uses for its scroll spin. */
const SCROLL_SPIN_SCALE = 0.000012;

/** Render settings for the About model canvas. */
const CANVAS = {
  bustScale: 5,
  bustY: 0,
  spinSpeed: 0.35,
  highlight: "#066aff",
  envIntensity: 1.5,
} as const;

const DRACO_PATH = "/draco/gltf/";
/** Longest-axis size after normalize; Center's `scale` then reads as world units. */
const MODEL_UNIT = 1;

useGLTF.setDecoderPath(DRACO_PATH);
useGLTF.preload(BUST_URL, DRACO_PATH);

const boxGeometry = new THREE.BoxGeometry();
const whiteMaterial = new THREE.MeshStandardMaterial({
  color: SWATCH_LIGHT_NUM,
});
const fallbackModelMaterial = new THREE.MeshStandardMaterial({
  color: SWATCH_LIGHT_NUM,
  roughness: 0.15,
  metalness: 0.1,
});

/** Find any mesh in a GLB — works across gltfjsx names, unnamed nodes, multi-mesh scenes. */
function prepareModelScene(scene: THREE.Object3D): {
  root: THREE.Object3D;
  scale: number;
} {
  const root = scene.clone(true);
  let meshCount = 0;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshCount += 1;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (!mesh.material) {
      mesh.material = fallbackModelMaterial;
    } else if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => m ?? fallbackModelMaterial);
    }
  });

  if (meshCount === 0) {
    return { root, scale: 1 };
  }

  // World-space bounds so node transforms (helmet exports, etc.) are respected.
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z, 1e-6);
  return { root, scale: MODEL_UNIT / longest };
}

/**
 * Drop any .glb at BUST_URL — no gltfjsx node/material names required.
 * Clones the scene, unit-normalizes it; Center handles framing.
 */
function Model() {
  const { scene } = useGLTF(BUST_URL, DRACO_PATH);
  const fitted = useMemo(() => prepareModelScene(scene), [scene]);

  const hasMesh = useMemo(() => {
    let found = false;
    fitted.root.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) found = true;
    });
    return found;
  }, [fitted.root]);

  if (!hasMesh) return null;

  return <primitive object={fitted.root} scale={fitted.scale} />;
}

function Room({ highlight }: { highlight: string }) {
  return (
    <group position={[0, -0.5, 0]}>
      <spotLight
        castShadow
        position={[-15, 20, 15]}
        angle={0.2}
        penumbra={1}
        intensity={2}
        decay={0}
      />
      <spotLight
        castShadow
        position={[15, 20, 15]}
        angle={0.2}
        penumbra={1}
        intensity={2}
        decay={0}
      />
      <spotLight
        castShadow
        position={[15, 20, -15]}
        angle={0.2}
        penumbra={1}
        intensity={2}
        decay={0}
      />
      <spotLight
        castShadow
        position={[-15, 20, -15]}
        angle={0.2}
        penumbra={1}
        intensity={2}
        decay={0}
      />
      <pointLight
        castShadow
        color="white"
        intensity={100}
        distance={28}
        decay={2}
        position={[0.5, 14.0, 0.5]}
      />
      <mesh
        geometry={boxGeometry}
        castShadow
        receiveShadow
        position={[0.0, 13.2, 0.0]}
        scale={[31.5, 28.5, 31.5]}
      >
        <meshStandardMaterial color="gray" side={THREE.BackSide} />
      </mesh>
      <mesh
        geometry={boxGeometry}
        material={whiteMaterial}
        castShadow
        receiveShadow
        position={[-10.906, -1.0, 1.846]}
        rotation={[0, -0.195, 0]}
        scale={[2.328, 7.905, 4.651]}
      />
      <mesh
        geometry={boxGeometry}
        material={whiteMaterial}
        castShadow
        receiveShadow
        position={[-5.607, -0.754, -0.758]}
        rotation={[0, 0.994, 0]}
        scale={[1.97, 1.534, 3.955]}
      />
      <mesh
        geometry={boxGeometry}
        material={whiteMaterial}
        castShadow
        receiveShadow
        position={[6.167, -0.16, 7.803]}
        rotation={[0, 0.561, 0]}
        scale={[3.927, 6.285, 3.687]}
      />
      <mesh
        geometry={boxGeometry}
        material={whiteMaterial}
        castShadow
        receiveShadow
        position={[-2.017, 0.018, 6.124]}
        rotation={[0, 0.333, 0]}
        scale={[2.002, 4.566, 2.064]}
      />
      <mesh
        geometry={boxGeometry}
        material={whiteMaterial}
        castShadow
        receiveShadow
        position={[2.291, -0.756, -2.621]}
        rotation={[0, -0.286, 0]}
        scale={[1.546, 1.552, 1.496]}
      />
      <mesh
        geometry={boxGeometry}
        material={whiteMaterial}
        castShadow
        receiveShadow
        position={[-2.193, -0.369, -5.547]}
        rotation={[0, 0.516, 0]}
        scale={[3.875, 3.487, 2.986]}
      />
      <Lightformer
        form="ring"
        position={[2, 3, -2]}
        scale={10}
        color={highlight}
        intensity={15}
      />
      <Lightformer
        form="box"
        intensity={80}
        position={[-14.0, 10.0, 8.0]}
        scale={[0.1, 2.5, 2.5]}
        target={false}
      />
      <Lightformer
        form="box"
        intensity={80}
        position={[-14.0, 14.0, -4.0]}
        scale={[0.1, 2.5, 2.5]}
        target={false}
        light={{ intensity: 100, distance: 28, decay: 2 }}
      />
      <Lightformer
        form="box"
        intensity={23}
        position={[14.0, 12.0, 0.0]}
        scale={[0.1, 5.0, 5.0]}
        target={false}
        light={{ intensity: 100, distance: 28, decay: 2 }}
      />
      <Lightformer
        form="box"
        intensity={16}
        position={[0.0, 9.0, 14.0]}
        scale={[5.0, 5.0, 0.1]}
        target={false}
        light={{ intensity: 100, distance: 28, decay: 2 }}
      />
      <Lightformer
        form="box"
        intensity={80}
        position={[7.0, 8.0, -14.0]}
        scale={[2.5, 2.5, 0.1]}
        target={false}
        light={{ intensity: 100, distance: 28, decay: 2 }}
      />
      <Lightformer
        form="box"
        intensity={80}
        position={[-7.0, 16.0, -14.0]}
        scale={[2.5, 2.5, 0.1]}
        target={false}
        light={{ intensity: 100, distance: 28, decay: 2 }}
      />
      <Lightformer
        form="box"
        intensity={1}
        position={[0.0, 20.0, 0.0]}
        scale={[0.1, 0.1, 0.1]}
        target={false}
        light={{ intensity: 100, distance: 28, decay: 2 }}
      />
      <Lightformer
        form="box"
        intensity={20}
        position={[0.0, 15, 0.0]}
        scale={[10, 1, 10]}
        target={false}
        light={{ intensity: 100, distance: 28, decay: 2 }}
      />
    </group>
  );
}

/** Isolate GLB / WebGL failures so they don't tear down Menu / the whole page. */
class ModelErrorBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "[AboutAsciiCanvas] model failed:",
      error,
      info.componentStack,
    );
    this.props.onError?.();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function BustReadyGate({ onReady }: { onReady?: () => void }) {
  const fired = useRef(false);

  useLayoutEffect(() => {
    if (fired.current) return;
    fired.current = true;
    onReady?.();
  }, [onReady]);

  return null;
}

function SpinY({ speed, children }: { speed: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const reduced = prefersReducedMotion();
  const scrollSpin = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const panel = document.querySelector<HTMLElement>(".about_panel_scroll");
    const st = ScrollTrigger.create({
      scroller:
        panel && panel.scrollHeight > panel.clientHeight + 1
          ? panel
          : undefined,
      start: 0,
      end: "max",
      onUpdate(self) {
        const v = self.getVelocity();
        if (!v) return;
        scrollSpin.current += v * SCROLL_SPIN_SCALE;
      },
    });
    return () => {
      st.kill();
    };
  }, [reduced]);

  useFrame((_, delta) => {
    if (reduced || !ref.current || speed === 0) return;
    ref.current.rotation.y += delta * speed + scrollSpin.current;
    scrollSpin.current = 0;
  });

  return <group ref={ref}>{children}</group>;
}

function AboutAsciiScene({ onReady }: { onReady?: () => void }) {
  return (
    /* ponytail: ink is the fixed light swatch, never `--text`. The plate under
       this canvas is `--dark-900` in both themes and the canvas composites with
       `mix-blend-mode: screen`, so dark ink would blend away to nothing.
       The pointer trail is `--brand-500` so it reads as the accent, not the
       blue fill light. */
    <AsciiField
      surface="about"
      ink={SWATCH_LIGHT}
      hoverHighlight={SWATCH_BRAND}
      fov={65}
      cameraPosition={[0, 0, 4]}
    >
      <group position={[0, -0.5, 0]}>
        <SpinY speed={CANVAS.spinSpeed}>
          <Center scale={CANVAS.bustScale} position={[0, CANVAS.bustY, 0]}>
            <ModelErrorBoundary>
              <Model />
            </ModelErrorBoundary>
          </Center>
        </SpinY>
      </group>
      {/* Both of these read `scene` and `camera` out of context, which the
          field's portal has already pointed at the offscreen pair. */}
      <OrbitControls
        enableDamping
        enableZoom={false}
        enablePan={false}
        // Left/right only — lock vertical tilt
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
      />
      <Environment
        resolution={256}
        background={false}
        environmentIntensity={CANVAS.envIntensity}
      >
        <Room highlight={CANVAS.highlight} />
      </Environment>
      <BustReadyGate onReady={onReady} />
    </AsciiField>
  );
}

type AboutAsciiCanvasProps = {
  eventSource?: RefObject<HTMLElement | null>;
  onReady?: () => void;
};

export default function AboutAsciiCanvas({
  eventSource,
  onReady,
}: AboutAsciiCanvasProps) {
  const maxDpr = getAboutCanvasMaxDpr();
  const [alive, setAlive] = useState(true);

  if (!alive) return null;

  return (
    <ModelErrorBoundary onError={() => setAlive(false)}>
      <Canvas
        className="about_panel_canvas"
        eventSource={eventSource as RefObject<HTMLElement> | undefined}
        frameloop="always"
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, maxDpr]}
        gl={{
          alpha: true,
          powerPreference: "high-performance",
          antialias: false,
        }}
        resize={{ scroll: false, debounce: 0 }}
        onCreated={({ gl, setSize }) => {
          /* Transparent GL clear — CSS .about_panel_media (--dark-900) is the
             ground, and the ASCII pass needs the offscreen clear transparent
             so bare background stamps no glyph. */
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;

          const el = gl.domElement.parentElement;
          if (el) {
            const ro = new ResizeObserver(() => {
              const { clientWidth: w, clientHeight: h } = el;
              if (w > 0 && h > 0) setSize(w, h);
            });
            ro.observe(el);
            gl.domElement.addEventListener(
              "webglcontextlost",
              (event) => {
                event.preventDefault();
                ro.disconnect();
                setAlive(false);
              },
              { once: true },
            );
          }
        }}
      >
        <Suspense fallback={null}>
          <AboutAsciiScene onReady={onReady} />
        </Suspense>
      </Canvas>
    </ModelErrorBoundary>
  );
}
