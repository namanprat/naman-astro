/**
 * One ASCII-shaded primitive per Process card. Atlas is shared; each Canvas
 * still owns its own WebGL texture. Frameloop is paused while `#process`
 * is off-screen.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { shaderColor } from "@/lib/site/cssColor";
import { getDufornAsciiAtlas } from "./teamCylinderAscii";
import { SHAPE_ASCII_FRAG, SHAPE_ASCII_VERT } from "./processCardAscii";

export type ProcessCardShape = "icosahedron" | "box" | "torus";

const ASCII_GRANULARITY = 18;
const ASCII_FONT_SIZE = 0.9;
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

function ShapeScene({
  shape,
  ink,
}: {
  shape: ProcessCardShape;
  ink: string;
}) {
  const { gl, size } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const asciiTex = useRef<THREE.CanvasTexture | null>(null);
  const [ready, setReady] = useState(false);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  const uniforms = useMemo(
    () => ({
      uAsciiTexture: { value: null as THREE.Texture | null },
      uGlyphCount: { value: 1 },
      uGranularity: { value: ASCII_GRANULARITY },
      uFontSize: { value: ASCII_FONT_SIZE },
      uSurfaceAspect: { value: 1 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uColor: { value: shaderColor(ink) },
      uTime: { value: 0 },
      uNoise: { value: reducedMotion ? 0 : ASCII_NOISE },
    }),
    [ink, reducedMotion],
  );

  useEffect(() => {
    uniforms.uColor.value.copy(shaderColor(ink));
  }, [ink, uniforms]);

  useEffect(() => {
    let disposed = false;
    getDufornAsciiAtlas()
      .then((ascii) => {
        if (disposed) {
          ascii.texture.dispose();
          return;
        }
        asciiTex.current = ascii.texture;
        uniforms.uAsciiTexture.value = ascii.texture;
        uniforms.uGlyphCount.value = ascii.glyphCount;
        setReady(true);
      })
      .catch(() => {
        /* Atlas failed — leave the well empty; title and copy stay readable. */
      });
    return () => {
      disposed = true;
      asciiTex.current?.dispose();
      asciiTex.current = null;
    };
  }, [uniforms]);

  useFrame((_, dt) => {
    const dpr = gl.getPixelRatio();
    uniforms.uResolution.value.set(size.width * dpr, size.height * dpr);
    uniforms.uSurfaceAspect.value = size.width / Math.max(size.height, 1);

    const mesh = meshRef.current;
    if (mesh) {
      mesh.rotation.x = TILT_X;
      mesh.rotation.z = TILT_Z;
      if (!reducedMotion) mesh.rotation.y += dt * SPIN_RAD_PER_SEC;
    }

    const mat = materialRef.current;
    if (mat && !reducedMotion) mat.uniforms.uTime.value += dt;
  });

  if (!ready) return null;

  return (
    <mesh ref={meshRef}>
      <ShapeGeometry shape={shape} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={SHAPE_ASCII_VERT}
        fragmentShader={SHAPE_ASCII_FRAG}
        side={THREE.DoubleSide}
        transparent
        depthWrite
        toneMapped={false}
      />
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
      camera={{ position: [0, 0, 2.8], fov: 35, near: 0.1, far: 20 }}
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
      <ShapeScene shape={shape} ink={ink} />
    </Canvas>
  );
}
