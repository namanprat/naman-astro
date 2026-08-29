/**
 * Home hero sculpture: duforn-old `newlogo.glb` with the baked chrome stripped
 * and drei's MeshTransmissionMaterial in its place.
 *
 * The HTML lockup stays in the chrome (gooey intro, a11y, click). A matching
 * wordmark plane is rendered only into the transmission buffer so refraction
 * can see it without covering the DOM mark.
 */
import "./HeroGlassCanvas.css";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Leva, useControls } from "leva";
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
import { useThemeInk } from "@/lib/site/ascii/useThemeInk";
import {
  HERO_SCENE_URL,
  HERO_WORDMARK_URL,
  canMountHeroGlass,
  heroGlassGuiEnabled,
} from "@/lib/site/heroGlass";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";

const DRACO_PATH = "/draco/gltf/";
const MODEL_UNIT = 1;
const SCROLL_YAW = 0.001;
const CAMERA_Z = 2.6;
const CAMERA_FOV = 28;
const WORDMARK_Z = -0.55;
const AUTO_ROTATE = 0.25;

const _origin = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const _dir = new THREE.Vector3();

useGLTF.setDecoderPath(DRACO_PATH);

function findFirstMesh(scene: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  scene.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) found = mesh;
  });
  return found;
}

function extractGeometry(scene: THREE.Object3D): THREE.BufferGeometry | null {
  const source = findFirstMesh(scene);
  if (!source) return null;

  const geom = source.geometry.clone();
  source.updateWorldMatrix(true, false);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  source.matrixWorld.decompose(pos, quat, scale);
  geom.applyQuaternion(quat);
  geom.scale(scale.x, scale.y, scale.z);
  geom.computeBoundingBox();
  geom.center();
  const size = geom.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
  const longest = Math.max(size.x, size.y, size.z, 1e-6);
  const fit = MODEL_UNIT / longest;
  geom.scale(fit, fit, fit);
  return geom;
}

function hitPlaneZ(
  camera: THREE.Camera,
  ndcX: number,
  ndcY: number,
  targetZ: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  _ndc.set(ndcX, ndcY, 0.5).unproject(camera);
  _origin.copy(camera.position);
  _dir.copy(_ndc).sub(_origin).normalize();
  const t = Math.abs(_dir.z) < 1e-6 ? 0 : (targetZ - _origin.z) / _dir.z;
  return out.copy(_origin).addScaledVector(_dir, t);
}

function WordmarkPlane() {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useTexture(HERO_WORDMARK_URL);
  const ink = useThemeInk("#ffffff");
  const { camera, gl } = useThree();

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.premultiplyAlpha = true;
    texture.needsUpdate = true;
  }, [texture]);

  /* Visible for MeshTransmissionMaterial's FBO pass (priority 0), hidden for
     the main render so the HTML lockup shows through the transparent canvas. */
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = true;

    const el = document.querySelector(".name_hero_lockup");
    if (!(el instanceof HTMLElement)) return;

    const rect = el.getBoundingClientRect();
    const canvas = gl.domElement.getBoundingClientRect();
    if (canvas.width < 1 || canvas.height < 1) return;

    const toNdc = (x: number, y: number) => ({
      x: ((x - canvas.left) / canvas.width) * 2 - 1,
      y: -((y - canvas.top) / canvas.height) * 2 + 1,
    });

    const mid = toNdc(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const east = toNdc(rect.right, rect.top + rect.height / 2);
    const south = toNdc(rect.left + rect.width / 2, rect.bottom);

    const center = hitPlaneZ(camera, mid.x, mid.y, WORDMARK_Z, new THREE.Vector3());
    const right = hitPlaneZ(camera, east.x, east.y, WORDMARK_Z, new THREE.Vector3());
    const bottom = hitPlaneZ(camera, south.x, south.y, WORDMARK_Z, new THREE.Vector3());

    mesh.position.copy(center);
    mesh.scale.set(
      Math.max(right.distanceTo(center) * 2, 1e-4),
      Math.max(bottom.distanceTo(center) * 2, 1e-4),
      1,
    );
  }, -1);

  useFrame(() => {
    const mesh = meshRef.current;
    if (mesh) mesh.visible = false;
  }, 1);

  return (
    <mesh ref={meshRef} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        color={ink}
        transparent
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GlassMesh({
  thickness,
  roughness,
  transmission,
  ior,
  chromaticAberration,
  backside,
  anisotropicBlur,
}: {
  thickness: number;
  roughness: number;
  transmission: number;
  ior: number;
  chromaticAberration: number;
  backside: boolean;
  anisotropicBlur: number;
}) {
  const { scene } = useGLTF(HERO_SCENE_URL, DRACO_PATH);
  const geometry = useMemo(() => extractGeometry(scene), [scene]);

  useEffect(() => {
    return () => geometry?.dispose();
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <MeshTransmissionMaterial
        thickness={thickness}
        roughness={roughness}
        transmission={transmission}
        ior={ior}
        chromaticAberration={chromaticAberration}
        backside={backside}
        anisotropicBlur={anisotropicBlur}
        samples={6}
        resolution={256}
      />
    </mesh>
  );
}

function HeroRig({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const autoYaw = useRef(0);
  const materialProps = useControls({
    thickness: { value: 0.2, min: 0, max: 3, step: 0.05 },
    roughness: { value: 0, min: 0, max: 1, step: 0.1 },
    transmission: { value: 1, min: 0, max: 1, step: 0.1 },
    ior: { value: 1.2, min: 0, max: 3, step: 0.1 },
    chromaticAberration: { value: 0.02, min: 0, max: 1 },
    backside: { value: true },
    anisotropicBlur: { value: 0.3, min: 0, max: 1, step: 0.01 },
  });

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const scrollYaw =
      typeof window === "undefined" ? 0 : window.scrollY * SCROLL_YAW;
    if (reducedMotion) {
      group.rotation.set(0, scrollYaw, 0);
      return;
    }
    autoYaw.current += AUTO_ROTATE * delta;
    group.rotation.set(0, autoYaw.current + scrollYaw, 0);
  });

  return (
    <>
      <WordmarkPlane />
      <group ref={groupRef}>
        <GlassMesh {...materialProps} />
      </group>
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
    const el = document.querySelector(".hero_glass");
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
  const showGui = useMemo(() => heroGlassGuiEnabled(), []);

  if (!alive) return null;

  return (
    <ModelErrorBoundary onError={() => setAlive(false)}>
      <Leva
        hidden={!showGui}
        collapsed
        titleBar={{ title: "Glass" }}
      />
      <Canvas
        className="hero_glass_canvas"
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
        <Suspense fallback={null}>
          <HeroRig reducedMotion={reducedMotion} />
          <GlassLights />
        </Suspense>
      </Canvas>
    </ModelErrorBoundary>
  );
}
