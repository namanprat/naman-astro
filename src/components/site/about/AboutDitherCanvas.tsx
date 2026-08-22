import {
  OrbitControls,
  Center,
  Environment,
  Lightformer,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, wrapEffect } from "@react-three/postprocessing";
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
import { DitheringEffect } from "./aboutDitherEffect";
import {
  AboutDistortionEffect,
  aboutDistortionState,
} from "./aboutDistortionEffect";
import { SWATCH_LIGHT_NUM } from "@/lib/site/siteColors";
import { getAboutCanvasMaxDpr, BUST_URL } from "@/lib/site/aboutBust";
import { hasFinePointerHover } from "@/lib/site/hasFinePointerHover";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";

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

const Dither = wrapEffect(DitheringEffect);

const Distortion = wrapEffect(AboutDistortionEffect);

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
      "[AboutDitherCanvas] model failed:",
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

function isInsideRect(event: PointerEvent, rect: DOMRect): boolean {
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

function AboutDistortionHover() {
  const { gl } = useThree();

  useEffect(() => {
    if (!hasFinePointerHover() || prefersReducedMotion()) return;

    const el = gl.domElement;
    const hitTarget: HTMLElement =
      (el.closest(".about_panel_media") as HTMLElement | null) ?? el;

    const syncPointer = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      aboutDistortionState.pointer.set(
        (event.clientX - rect.left) / rect.width,
        1 - (event.clientY - rect.top) / rect.height,
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = hitTarget.getBoundingClientRect();
      if (!isInsideRect(event, rect)) {
        aboutDistortionState.strengthTarget = 0;
        return;
      }
      syncPointer(event);
      aboutDistortionState.strengthTarget = 1;
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (
        event.relatedTarget instanceof Node &&
        hitTarget.contains(event.relatedTarget)
      )
        return;
      aboutDistortionState.strengthTarget = 0;
    };

    const onBlur = () => {
      aboutDistortionState.strengthTarget = 0;
    };

    hitTarget.addEventListener("pointermove", onPointerMove, { passive: true });
    hitTarget.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onBlur);
    return () => {
      hitTarget.removeEventListener("pointermove", onPointerMove);
      hitTarget.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onBlur);
      aboutDistortionState.strength = 0;
      aboutDistortionState.strengthTarget = 0;
    };
  }, [gl]);

  useFrame((_, delta) => {
    const lerp = 1 - Math.exp(-delta * 10);
    aboutDistortionState.strength +=
      (aboutDistortionState.strengthTarget - aboutDistortionState.strength) *
      lerp;
  });

  return null;
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

  useFrame((_, delta) => {
    if (reduced || !ref.current || speed === 0) return;
    ref.current.rotation.y += delta * speed;
  });

  return <group ref={ref}>{children}</group>;
}

function AboutDitherScene({ onReady }: { onReady?: () => void }) {
  return (
    <>
      <group position={[0, -0.5, 0]}>
        <SpinY speed={CANVAS.spinSpeed}>
          <Center scale={CANVAS.bustScale} position={[0, CANVAS.bustY, 0]}>
            <ModelErrorBoundary>
              <Model />
            </ModelErrorBoundary>
          </Center>
        </SpinY>
      </group>
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
      <AboutDistortionHover />
      <EffectComposer
        multisampling={0}
        enableNormalPass={false}
        stencilBuffer={false}
      >
        <Distortion />
        <Dither />
      </EffectComposer>
      <BustReadyGate onReady={onReady} />
    </>
  );
}

type AboutDitherCanvasProps = {
  eventSource?: RefObject<HTMLElement | null>;
  onReady?: () => void;
};

export default function AboutDitherCanvas({
  eventSource,
  onReady,
}: AboutDitherCanvasProps) {
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
        camera={{ position: [0, 0, 4], fov: 65 }}
        gl={{
          alpha: true,
          powerPreference: "high-performance",
          antialias: false,
        }}
        resize={{ scroll: false, debounce: 0 }}
        onCreated={({ gl, setSize }) => {
          /* Transparent GL clear — CSS .about_panel_media (--black) is the ground. */
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
          <AboutDitherScene onReady={onReady} />
        </Suspense>
      </Canvas>
    </ModelErrorBoundary>
  );
}
