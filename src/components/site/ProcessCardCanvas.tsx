/**
 * One ASCII-shaded primitive per Process card.
 *
 * The primitive is now an ordinary lit mesh — the ASCII lives entirely in
 * `AsciiField`, shared with About and Team. Frameloop is paused while
 * `#process` is off-screen.
 */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import AsciiField from "./ascii/AsciiField";

gsap.registerPlugin(ScrollTrigger);

export type ProcessCardShape = "icosahedron" | "box" | "torus";

/**
 * Scroll velocity (px/s) → radians, signed, so the shapes turn with the scroll
 * and reverse when it does. Half the cylinder carousel's 0.000012 so the cards
 * read as slower than the strip. There is deliberately no idle term — unlike
 * the cylinder, a page at rest leaves these still.
 */
const SPIN_RAD_PER_VELOCITY = 0.000006;
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
  const spinDelta = useRef(0);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

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
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.x = TILT_X;
    mesh.rotation.z = TILT_Z;
    // Drained every frame: no scroll since the last one means no turn.
    mesh.rotation.y += spinDelta.current;
    spinDelta.current = 0;
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
        surface="process"
        ink={ink}
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
