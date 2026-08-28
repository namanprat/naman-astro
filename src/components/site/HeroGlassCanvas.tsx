/**
 * Home hero sculpture: duforn-old `newlogo.glb` with the baked chrome stripped
 * and a shared frosted MeshPhysicalMaterial in its place.
 *
 * Interaction matches logo-3d.js — OrbitControls (no pan/zoom, auto-rotate)
 * plus a scroll-linked yaw — without letting the rig steal Lenis on phones.
 */
import "./HeroGlassCanvas.css";
import {
  Center,
  Environment,
  Lightformer,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { hasFinePointerHover } from "@/lib/site/hasFinePointerHover";
import {
  HERO_SCENE_URL,
  canMountHeroGlass,
  getHeroGlass,
  subscribeHeroGlass,
  type HeroGlassControls,
} from "@/lib/site/heroGlass";
import { ensureHeroGlassGui } from "@/lib/site/heroGlassGui";

const DRACO_PATH = "/draco/gltf/";
const MODEL_UNIT = 1;
const SCROLL_YAW = 0.001;
const CAMERA_Z = 2.6;
const CAMERA_FOV = 28;

useGLTF.setDecoderPath(DRACO_PATH);

function applyGlass(
  mat: THREE.MeshPhysicalMaterial,
  c: HeroGlassControls,
): void {
  mat.color.set(c.color);
  mat.transmission = c.transmission;
  mat.roughness = c.roughness;
  mat.thickness = c.thickness;
  mat.ior = c.ior;
  mat.envMapIntensity = c.envMapIntensity;
  mat.opacity = c.opacity;
  mat.transparent = c.opacity < 1 || c.transmission > 0;
  mat.depthWrite = c.opacity >= 1;
  mat.needsUpdate = true;
}

function prepareGlassScene(
  scene: THREE.Object3D,
  material: THREE.MeshPhysicalMaterial,
): { root: THREE.Object3D; scale: number } {
  const root = scene.clone(true);
  let meshCount = 0;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = `${mesh.name} ${
      Array.isArray(mesh.material) ? mesh.material[0]?.name : mesh.material?.name
    }`;
    if (/water/i.test(name)) {
      mesh.visible = false;
      return;
    }
    meshCount += 1;
    mesh.material = material;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });

  if (meshCount === 0) return { root, scale: 1 };

  root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z, 1e-6);
  return { root, scale: MODEL_UNIT / longest };
}

function GlassModel({
  material,
}: {
  material: THREE.MeshPhysicalMaterial;
}) {
  const { scene } = useGLTF(HERO_SCENE_URL, DRACO_PATH);
  const fitted = useMemo(
    () => prepareGlassScene(scene, material),
    [scene, material],
  );
  return (
    <Center>
      <primitive object={fitted.root} scale={fitted.scale} />
    </Center>
  );
}

function HeroRig({
  material,
  reducedMotion,
}: {
  material: THREE.MeshPhysicalMaterial;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const autoYaw = useRef(0);
  const finePointer = useMemo(() => hasFinePointerHover(), []);

  useEffect(() => {
    const sync = () => applyGlass(material, getHeroGlass());
    sync();
    return subscribeHeroGlass(sync);
  }, [material]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const c = getHeroGlass();
    applyGlass(material, c);
    group.scale.setScalar(c.scale);

    const scrollYaw =
      typeof window === "undefined" ? 0 : window.scrollY * SCROLL_YAW;
    const offset = (c.rotateY * Math.PI) / 180;

    if (reducedMotion) {
      group.rotation.set(0, offset, 0);
      return;
    }

    autoYaw.current += (c.autoRotateSpeed * delta) / 4;
    group.rotation.set(0, autoYaw.current + offset + scrollYaw, 0);
  });

  return (
    <>
      <group ref={groupRef}>
        <Suspense fallback={null}>
          <GlassModel material={material} />
        </Suspense>
      </group>
      {!reducedMotion && (
        <OrbitControls
          enableDamping
          enablePan={false}
          enableZoom={false}
          autoRotate={false}
          enabled={finePointer}
        />
      )}
    </>
  );
}

function GlassLights() {
  return (
    <Environment resolution={256} background={false}>
      <Lightformer
        form="rect"
        intensity={4}
        position={[0, 3, 2]}
        scale={[8, 2, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2}
        position={[-4, 1, 1]}
        scale={[2, 6, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2}
        position={[4, 1, 1]}
        scale={[2, 6, 1]}
      />
      <Lightformer form="ring" intensity={3} position={[0, 0, -4]} scale={6} />
    </Environment>
  );
}

class ModelErrorBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[HeroGlassCanvas] model failed:", error, info.componentStack);
    this.props.onError?.();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function useHeroVisible(): boolean {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const el = document.querySelector(".hero_model");
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "80px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return active;
}

export default function HeroGlassCanvas() {
  const [alive, setAlive] = useState(() => canMountHeroGlass());
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const active = useHeroVisible();
  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      metalness: 0,
      side: THREE.DoubleSide,
      toneMapped: true,
    });
    applyGlass(mat, getHeroGlass());
    return mat;
  }, []);

  useEffect(() => {
    void ensureHeroGlassGui();
  }, []);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  if (!alive) return null;

  return (
    <ModelErrorBoundary onError={() => setAlive(false)}>
      <Canvas
        className="hero_model_canvas"
        frameloop={active ? "always" : "never"}
        dpr={[1, 1.5]}
        camera={{ fov: CAMERA_FOV, position: [0, 0, CAMERA_Z], near: 0.1, far: 40 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        resize={{ scroll: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <ambientLight intensity={0.15} />
        <HeroRig material={material} reducedMotion={reducedMotion} />
        <GlassLights />
      </Canvas>
    </ModelErrorBoundary>
  );
}
