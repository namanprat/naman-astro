/**
 * The hero object: duforn-old's logo GLB (`duforn-old/logo-3d.js`, then
 * `newlogo.glb`) with its `Car chrome` material thrown away and drei's
 * `MeshTransmissionMaterial` in its place.
 *
 * The interaction is the old one — damped drag, autorotate, no pan, no zoom,
 * plus a Y spin driven off scroll position — but it turns the mesh rather than
 * the camera. `OrbitControls` orbits the camera, and the wordmark plane under
 * the glass is placed in screen space against a fixed one; moving the camera
 * would drag the mark off the DOM lockup it is standing in for. Object-space
 * rotation is the same gesture with the frame held still.
 *
 * Framing is the other departure: the original ran a 15° camera at `z = 0.135`,
 * which leaves the wordmark plane and the shell inside ~0.035 world units of
 * depth. The mesh is normalised instead and the camera is ordinary.
 */
import { useEffect, useMemo, useRef } from "react";
import { MeshTransmissionMaterial, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getGlassTuning } from "@/lib/site/hero/glassTuning";

export const HERO_MODEL_URL = "/models/hero-logo.glb";

useGLTF.preload(HERO_MODEL_URL);

/** Radians per pixel dragged. */
const DRAG_SPEED = 0.006;
/** Per-frame velocity decay after release — `OrbitControls`' dampingFactor 0.05. */
const DAMPING = 0.95;
/** Below this the fling is over; stops a demand frameloop spinning forever. */
const REST = 1e-4;
/** `autoRotateSpeed: 1` in `OrbitControls` is one turn per 60s. */
const AUTO_RAD_PER_S = (Math.PI * 2) / 60;
/** Matches the polar clamp `OrbitControls` applies by default. */
const TILT_LIMIT = Math.PI / 2;

type HeroGlassModelProps = {
  /** Live material props, already merged with the phone overrides. */
  material: Record<string, number | boolean>;
  /** The page fill, so refracted empty scene reads as the page, not a hole. */
  background: THREE.Color;
  /** False on phones — duforn-old cut pointer input on small screens too. */
  interactive: boolean;
  /** False under reduced motion: no autorotate, no scroll spin. */
  animate: boolean;
};

export default function HeroGlassModel({
  material,
  background,
  interactive,
  animate,
}: HeroGlassModelProps) {
  const group = useRef<THREE.Group>(null);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const viewport = useThree((state) => state.viewport);
  const invalidate = useThree((state) => state.invalidate);
  const { scene } = useGLTF(HERO_MODEL_URL);

  /** Merged geometry, centred on its own bounds and normalised to one unit. */
  const fitted = useMemo(() => {
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

  const motion = useRef({ x: 0, y: 0, vx: 0, vy: 0, dragging: false });

  /* ── Drag ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!interactive) return;
    const canvas = gl.domElement;
    const state = motion.current;
    let lastX = 0;
    let lastY = 0;

    const onDown = (event: PointerEvent) => {
      state.dragging = true;
      state.vx = 0;
      state.vy = 0;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onMove = (event: PointerEvent) => {
      if (!state.dragging) return;
      // Velocity is *set*, not accumulated: on release the last frame's travel
      // is what carries into the damped fling.
      state.vy = (event.clientX - lastX) * DRAG_SPEED;
      state.vx = (event.clientY - lastY) * DRAG_SPEED;
      state.y += state.vy;
      state.x += state.vx;
      lastX = event.clientX;
      lastY = event.clientY;
      invalidate();
    };

    const onUp = (event: PointerEvent) => {
      if (!state.dragging) return;
      state.dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      canvas.style.cursor = "grab";
      invalidate();
    };

    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.style.cursor = "";
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [gl, interactive, invalidate]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const state = motion.current;
    const { scene: tuning } = getGlassTuning();

    if (!state.dragging) {
      if (Math.abs(state.vx) > REST || Math.abs(state.vy) > REST) {
        state.vx *= DAMPING;
        state.vy *= DAMPING;
        state.x += state.vx;
        state.y += state.vy;
      } else {
        state.vx = 0;
        state.vy = 0;
      }
      if (animate) {
        state.y += tuning.autoRotateSpeed * AUTO_RAD_PER_S * delta;
      }
    }

    state.x = THREE.MathUtils.clamp(state.x, -TILT_LIMIT, TILT_LIMIT);
    node.rotation.x = state.x;
    // duforn-old drove the scroll spin off position rather than accumulated
    // velocity, so the mark returns to the same angle at the top of the page.
    node.rotation.y =
      state.y + (animate ? window.scrollY * tuning.scrollSpin : 0);
  });

  if (!fitted) return null;

  const { scene: tuning } = getGlassTuning();
  // Fraction of the visible width at the model's depth — the reference
  // snippet's `viewport.width / 3`. A fixed world size fills a desktop and
  // overruns a phone.
  const width = viewport.getCurrentViewport(camera, [
    0,
    0,
    tuning.modelDepth,
  ]).width;

  return (
    <group ref={group} position={[0, 0, tuning.modelDepth]}>
      <mesh
        geometry={fitted.geo}
        scale={fitted.unit * width * tuning.modelScale}
      >
        <MeshTransmissionMaterial {...material} background={background} />
      </mesh>
    </group>
  );
}
