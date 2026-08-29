/**
 * Shared hero logo transform — one spin group for the glass mesh and the ASCII
 * offscreen clone so both stay locked together.
 */
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getGlassTuning } from "@/lib/site/hero/glassTuning";

export const HERO_MODEL_URL = "/models/hero-logo.glb";

useGLTF.preload(HERO_MODEL_URL);

/** duforn-old ran `OrbitControls.autoRotateSpeed` at 1 — one turn per 60s. */
const AUTO_RAD_PER_S = (Math.PI * 2) / 60;

export type HeroLogoFitted = {
  geo: THREE.BufferGeometry;
  unit: number;
};

export type HeroLogoContextValue = {
  groupRef: RefObject<THREE.Group | null>;
  scaleRef: RefObject<THREE.Group | null>;
  fitted: HeroLogoFitted | null;
  modelScale: number;
};

const HeroLogoContext = createContext<HeroLogoContextValue | null>(null);

export function useHeroLogo(): HeroLogoContextValue {
  const ctx = useContext(HeroLogoContext);
  if (!ctx) {
    throw new Error("useHeroLogo must be used inside HeroLogoShell");
  }
  return ctx;
}

function useHeroLogoFitted(): HeroLogoFitted | null {
  const { scene } = useGLTF(HERO_MODEL_URL);
  return useMemo(() => {
    let geometry: THREE.BufferGeometry | null = null;
    scene.updateMatrixWorld(true);
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || geometry) return;
      geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
    });
    if (!geometry) return null;

    const geo = geometry as THREE.BufferGeometry;
    geo.center();
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const size = geo.boundingBox!.getSize(new THREE.Vector3());
    return { geo, unit: 1 / Math.max(size.x, size.y, size.z, 1e-6) };
  }, [scene]);
}

type HeroLogoShellProps = {
  animate: boolean;
  children: ReactNode;
};

export function HeroLogoShell({ animate, children }: HeroLogoShellProps) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const camera = useThree((state) => state.camera);
  const viewport = useThree((state) => state.viewport);
  const fitted = useHeroLogoFitted();

  useFrame((_, delta) => {
    const node = groupRef.current;
    if (!node) return;
    const { scene: tuning } = getGlassTuning();

    if (animate)
      spin.current += tuning.autoRotateSpeed * AUTO_RAD_PER_S * delta;
    node.rotation.y =
      spin.current + (animate ? window.scrollY * tuning.scrollSpin : 0);
    // Negative priority: the transform has to settle before anything renders,
    // and `HeroAsciiReveal` renders this same mesh into its own target from a
    // pass of its own. A frame of lag there shears the glyphs off the glass.
    // Only `priority > 0` takes R3F's automatic render away.
  }, -3);

  const { scene: tuning } = getGlassTuning();
  const width = viewport.getCurrentViewport(camera, [
    0,
    0,
    tuning.modelDepth,
  ]).width;
  const worldScale = fitted ? fitted.unit * width * tuning.modelScale : 1;

  const value = useMemo(
    (): HeroLogoContextValue => ({
      groupRef,
      scaleRef,
      fitted,
      modelScale: tuning.modelScale,
    }),
    [fitted, tuning.modelScale],
  );

  if (!fitted) return null;

  return (
    <HeroLogoContext.Provider value={value}>
      <group ref={groupRef} position={[0, 0, tuning.modelDepth]}>
        <group ref={scaleRef} scale={worldScale}>
          {children}
        </group>
      </group>
    </HeroLogoContext.Provider>
  );
}
