import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { rigState } from "@/lib/archive/rigState";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";

const SIZE = 120;
const DIVISIONS = 60;
const COLOR = "#757575";
const ORB_Z = -9;
const lerp = THREE.MathUtils.lerp;

/** Line spacing (world units). Wrapping pan by this tiles the grid infinitely. */
const SPACING = SIZE / DIVISIONS;
const wrap = (v: number) => v - Math.round(v / SPACING) * SPACING;

/** Cursor-proximity glow tuning. Soft bright pool that tracks the pointer. */
const GLOW_RADIUS = 10; // world units; pool half-width on the grid plane
const GLOW_STRENGTH = 1.2; // peak brightness add at the cursor
const GLOW_LERP = 0.08; // cursor-follow + fade-in/out smoothing

const VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform vec2 uCursor;
  uniform float uGlowRadius;
  uniform float uGlowStrength;
  uniform float uGlowActive;
  varying vec3 vWorldPos;
  void main() {
    float d = distance(vWorldPos.xy, uCursor);
    float glow = smoothstep(uGlowRadius, 0.0, d) * uGlowStrength * uGlowActive;
    vec3 col = uColor * (1.0 + glow);
    float op = clamp(uOpacity * (1.0 + glow * 0.6), 0.0, 1.0);
    gl_FragColor = vec4(col, op);
  }
`;

/** Graph-paper backdrop — parallax orb grid morphs flat and follows pan. */
export default function ArchiveGridScene() {
  const ref = useRef<THREE.GridHelper>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  // Pointer in NDC: target updated on move, smoothed toward each frame.
  const pointerTarget = useRef(new THREE.Vector2(0, 0));
  const pointerSmooth = useRef(new THREE.Vector2(0, 0));
  const pointerActive = useRef(false); // 0/1 intent, lerped into uGlowActive

  const glowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        uniforms: {
          uColor: { value: new THREE.Color(COLOR) },
          uOpacity: { value: 0.55 },
          uCursor: { value: new THREE.Vector2(0, 0) },
          uGlowRadius: { value: GLOW_RADIUS },
          uGlowStrength: { value: GLOW_STRENGTH },
          uGlowActive: { value: 0 },
        },
      }),
    [],
  );

  useEffect(() => {
    if (prefersReducedMotion()) return; // grid stays static, no glow
    // Canvas box, not the window: the stage spans the whole screen while the
    // window reports the height mobile Safari's chrome leaves over, and the
    // mismatch would drag the glow away from the cursor.
    const canvas = gl.domElement;
    const w = () => Math.max(canvas.clientWidth, 1);
    const h = () => Math.max(canvas.clientHeight, 1);
    const onMove = (e: PointerEvent) => {
      pointerTarget.current.set(
        (e.clientX / w()) * 2 - 1,
        -(e.clientY / h()) * 2 + 1,
      );
      pointerActive.current = true;
    };
    const onLeave = () => {
      pointerActive.current = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      glowMaterial.dispose();
    };
  }, [glowMaterial, gl]);

  useFrame(() => {
    const grid = ref.current;
    if (!grid) return;

    const m = rigState.morph;
    const u = glowMaterial.uniforms;
    u.uOpacity.value = lerp(0.55, 0.35, m);

    // Smooth the cursor and project it onto the grid plane (world z = ORB_Z).
    pointerSmooth.current.lerp(pointerTarget.current, GLOW_LERP);
    const ray = new THREE.Vector3(
      pointerSmooth.current.x,
      pointerSmooth.current.y,
      0.5,
    );
    ray.unproject(camera).sub(camera.position).normalize();
    if (Math.abs(ray.z) > 1e-4) {
      const t = (ORB_Z - camera.position.z) / ray.z;
      (u.uCursor.value as THREE.Vector2).set(
        camera.position.x + ray.x * t,
        camera.position.y + ray.y * t,
      );
    }
    u.uGlowActive.value = lerp(
      u.uGlowActive.value,
      pointerActive.current ? 1 : 0,
      GLOW_LERP,
    );

    if (m < 0.02) {
      // Orb view: grid stays static — no yaw-driven shift, no tilt.
      grid.position.set(0, 0, ORB_Z);
      grid.rotation.set(Math.PI / 2, 0, 0);
      grid.scale.setScalar(1);
      return;
    }

    if (m > 0.98) {
      // Stay at the orb depth so the grid keeps its orb size (no zoom-in). Wrap pan
      // by the line spacing — the uniform grid loops seamlessly = infinite.
      grid.position.set(
        wrap(rigState.gridPan.x),
        wrap(rigState.gridPan.y),
        ORB_Z,
      );
      grid.rotation.set(Math.PI / 2, 0, 0);
      grid.scale.setScalar(1);
      return;
    }

    const eased = m * m * (3 - 2 * m);
    grid.position.set(
      lerp(0, rigState.gridPan.x, eased),
      lerp(0, rigState.gridPan.y, eased),
      ORB_Z,
    );
    grid.rotation.set(Math.PI / 2, 0, 0);
    grid.scale.setScalar(1);
  });

  return (
    <gridHelper
      ref={(node) => {
        ref.current = node;
        if (node) {
          node.renderOrder = -1;
          node.material = glowMaterial as unknown as THREE.LineBasicMaterial;
        }
      }}
      args={[SIZE, DIVISIONS, COLOR, COLOR]}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, ORB_Z]}
    />
  );
}
