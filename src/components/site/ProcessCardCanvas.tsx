/**
 * One ASCII-shaded GLB per Process card.
 *
 * The mesh is an ordinary lit surface — the ASCII lives entirely in
 * `AsciiField`, shared with About and Team. Materials are replaced with a
 * white standard so glyph density comes from lighting, not from Sketchfab
 * albedo (the flower's leaves would otherwise stamp no glyphs). Frameloop is
 * paused while `#process` is off-screen.
 */
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
import { Center, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { ensureProcessModelGui } from "@/lib/site/process/processModelGui";
import {
  PROCESS_CARD_IDS,
  PROCESS_MODEL_URLS,
  getProcessModelTuning,
  subscribeProcessModelTuning,
  type ProcessCardId,
} from "@/lib/site/process/processModelTuning";
import AsciiField from "./ascii/AsciiField";

gsap.registerPlugin(ScrollTrigger);

for (const id of PROCESS_CARD_IDS) {
  useGLTF.preload(PROCESS_MODEL_URLS[id]);
}

type ProcessCardCanvasProps = {
  ink: string;
  active: boolean;
  model: ProcessCardId;
};

function prepareLitClone(
  scene: THREE.Object3D,
  material: THREE.MeshStandardMaterial,
): { root: THREE.Object3D; unitScale: number } {
  const root = scene.clone(true);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = material;
  });
  root.updateMatrixWorld(true);
  const size = new THREE.Box3()
    .setFromObject(root)
    .getSize(new THREE.Vector3());
  const unitScale = 1 / Math.max(size.x, size.y, size.z, 1e-6);
  return { root, unitScale };
}

class ModelErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "[ProcessCardCanvas] model failed:",
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function CardModel({ card }: { card: ProcessCardId }) {
  const poseRef = useRef<THREE.Group>(null);
  const spinY = useRef(0);
  const scrollDelta = useRef(0);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const { scene } = useGLTF(PROCESS_MODEL_URLS[card]);
  const tuning = getProcessModelTuning(card);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.4,
        metalness: 0,
        flatShading: false,
      }),
    [],
  );

  const fitted = useMemo(
    () => prepareLitClone(scene, material),
    [scene, material],
  );

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    if (reducedMotion) return;
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate(self) {
        const v = self.getVelocity();
        if (!v) return;
        scrollDelta.current += v * tuning.scrollSpin;
      },
    });
    return () => {
      st.kill();
    };
  }, [reducedMotion, tuning]);

  useFrame((_, delta) => {
    const group = poseRef.current;
    if (!group) return;

    material.roughness = tuning.roughness;
    material.metalness = tuning.metalness;
    if (material.flatShading !== tuning.flatShading) {
      material.flatShading = tuning.flatShading;
      material.needsUpdate = true;
    }

    if (!reducedMotion) {
      spinY.current += delta * tuning.idleSpin + scrollDelta.current;
    }
    scrollDelta.current = 0;

    group.position.set(tuning.posX, tuning.posY, tuning.posZ);
    group.rotation.set(tuning.rotX, tuning.rotY + spinY.current, tuning.rotZ);
    group.scale.setScalar(tuning.scale);
  });

  return (
    <group ref={poseRef}>
      <Center>
        <primitive object={fitted.root} scale={fitted.unitScale} />
      </Center>
    </group>
  );
}

export default function ProcessCardCanvas({
  ink,
  active,
  model,
}: ProcessCardCanvasProps) {
  const [, setVersion] = useState(0);
  const tuning = getProcessModelTuning(model);

  useEffect(
    () => subscribeProcessModelTuning(model, () => setVersion((n) => n + 1)),
    [model],
  );
  useEffect(() => {
    void ensureProcessModelGui();
  }, []);

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
          plate is light in both themes, so following the toggle would erase it.
          `setVersion` re-reads the store after a GUI drag so fov / camera /
          lights update; pose is applied in the frame loop off the live object. */}
      <AsciiField
        surface="process"
        ink={ink}
        fov={tuning.fov}
        cameraPosition={[0, 0, tuning.camZ]}
        far={20}
      >
        <ambientLight intensity={tuning.ambient} />
        <directionalLight
          position={[tuning.lightX, tuning.lightY, tuning.lightZ]}
          intensity={tuning.directional}
        />
        <Suspense fallback={null}>
          <ModelErrorBoundary>
            <CardModel card={model} />
          </ModelErrorBoundary>
        </Suspense>
      </AsciiField>
    </Canvas>
  );
}
