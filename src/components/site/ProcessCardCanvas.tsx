/**
 * One ASCII-shaded primitive per Process card.
 *
 * The primitive is now an ordinary lit mesh — the ASCII lives entirely in
 * `AsciiField`, shared with About and Team. Frameloop is paused while
 * `#process` is off-screen.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import AsciiField from "./ascii/AsciiField";

export type ProcessCardShape = "icosahedron" | "box" | "torus";

/** Glyph rows across the card's short axis. */
const ASCII_DENSITY = 26;
const ASCII_NOISE = 0.35;
const SPIN_RAD_PER_SEC = 0.4;
const TILT_X = 0.4;
const TILT_Z = 0.12;

type ProcessCardCanvasProps = {
  shape: ProcessCardShape;
  ink: string;
  active: boolean;
};

function ShapeGeometry({ shape }: { shape: ProcessCardShape }) {
  if (shape === "box") return <boxGeometry args={[1.15, 1.15, 1.15]} />;
  if (shape === "torus") return <torusGeometry args={[0.72, 0.28, 16, 48]} />;
  return <icosahedronGeometry args={[1, 1]} />;
}

function SpinningShape({ shape }: { shape: ProcessCardShape }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.x = TILT_X;
    mesh.rotation.z = TILT_Z;
    if (!reducedMotion) mesh.rotation.y += dt * SPIN_RAD_PER_SEC;
  });

  return (
    <mesh ref={meshRef}>
      <ShapeGeometry shape={shape} />
      <meshStandardMaterial color="#ffffff" roughness={0.35} metalness={0} />
    </mesh>
  );
}

export default function ProcessCardCanvas({
  shape,
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
        density={ASCII_DENSITY}
        ink={ink}
        noise={ASCII_NOISE}
        fov={35}
        cameraPosition={[0, 0, 2.8]}
        far={20}
      >
        {/* Archive's rig: a near-black ambient with one hard key, so the
            brightness ramp the glyphs read off is wide. */}
        <ambientLight intensity={0.05} />
        <directionalLight position={[1, 0, 0.866]} intensity={2.5} />
        <SpinningShape shape={shape} />
      </AsciiField>
    </Canvas>
  );
}
