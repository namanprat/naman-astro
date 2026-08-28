/**
 * One ASCII-shaded wireframe sphere per Process card.
 *
 * The GLB is an ordinary lit mesh — the ASCII lives entirely in `AsciiField`,
 * shared with About and Team. Frameloop is paused while `#process` is off-screen.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Center, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import AsciiField from "./ascii/AsciiField";

gsap.registerPlugin(ScrollTrigger);

const SPHERE_URL = "/models/wireframe_sphere.glb";
/** Longest-axis size after normalize — same ballpark as the old 1.15 box. */
const MODEL_SIZE = 1.6;
const SPIN_RAD_PER_VELOCITY = 0.000006;
const TILT_X = 0.4;
const TILT_Z = 0.12;

useGLTF.preload(SPHERE_URL);

type ProcessCardCanvasProps = {
  ink: string;
  active: boolean;
};

function SpinningSphere() {
  const groupRef = useRef<THREE.Group>(null);
  const spinDelta = useRef(0);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const { scene } = useGLTF(SPHERE_URL);

  const fitted = useMemo(() => {
    const root = scene.clone(true);
    const material = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.35,
      metalness: 0,
    });
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = material;
    });
    root.updateMatrixWorld(true);
    const size = new THREE.Box3()
      .setFromObject(root)
      .getSize(new THREE.Vector3());
    const scale = MODEL_SIZE / Math.max(size.x, size.y, size.z, 1e-6);
    return { root, scale };
  }, [scene]);

  useEffect(() => {
    if (reducedMotion) return;
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate(self) {
        const v = self.getVelocity();
        if (!v) return;
        spinDelta.current += v * SPIN_RAD_PER_VELOCITY;
      },
    });
    return () => {
      st.kill();
    };
  }, [reducedMotion]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    group.rotation.x = TILT_X;
    group.rotation.z = TILT_Z;
    group.rotation.y += spinDelta.current;
    spinDelta.current = 0;
  });

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={fitted.root} scale={fitted.scale} />
      </Center>
    </group>
  );
}

export default function ProcessCardCanvas({
  ink,
  active,
}: ProcessCardCanvasProps) {
  return (
    <Canvas
      className="process_card_canvas"
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.25]}
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      }}
      resize={{ scroll: false }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      {/* ponytail: `ink` is a literal from Process.tsx, not `--text` — the card
          plate is light in both themes, so following the toggle would erase it. */}
      <AsciiField
        surface="process"
        ink={ink}
        fov={35}
        cameraPosition={[0, 0, 2.8]}
        far={20}
      >
        <ambientLight intensity={0.05} />
        <directionalLight position={[1, 0, 0.866]} intensity={2.5} />
        <Suspense fallback={null}>
          <SpinningSphere />
        </Suspense>
      </AsciiField>
    </Canvas>
  );
}
