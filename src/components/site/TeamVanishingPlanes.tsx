/**
 * Vanishing-point emitter of discrete portrait planes, as an R3F island.
 *
 * Two streams leave screen center: small and far at u=0, larger and yawed
 * at u=1. Scroll sign drives direction — outward on the way down, back
 * toward the vanishing point on the way up. Crossing either end recycles
 * that plane on the same arm with the next/previous image, so both sides
 * stay infinite either way. Nothing spins. Glyphs come from `AsciiField`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { workItems } from "@/content/work";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { useThemeInk, useThemeLight } from "@/lib/site/ascii/useThemeInk";
import AsciiField from "./ascii/AsciiField";

gsap.registerPlugin(ScrollTrigger);

/** Work covers plus detail stills so both streams stay dense. */
const IMAGE_SRCS = [
  ...workItems.map((item) => item.image),
  "/work/haptic/haptic-hero.webp",
  "/work/money-me/money-cover.webp",
];
const IMAGE_COUNT = IMAGE_SRCS.length;
/** Independent left and right streams, staggered along u. */
const PLANES_PER_SIDE = 5;
const PLANE_COUNT = PLANES_PER_SIDE * 2;
/** Portrait tile — 3:4 width:height. */
const TILE_ASPECT = 3 / 4;
const TILE_W = 768;
const TILE_H = Math.round(TILE_W / TILE_ASPECT);
const PLANE_H = 1.05;
const PLANE_W = PLANE_H * TILE_ASPECT;
/** Must match the AsciiField offscreen camera — that is the lens that sees these planes. */
const OFF_FOV = 45;
const OFF_CAM_Z = 6.5;
/** px/s scroll velocity → signed progress. Down is outward, up is inward. */
const VELOCITY_U_SCALE = 0.000015;
/** Idle crawl (progress/s) from center toward each lip. */
const IDLE_U_PER_SEC = 0.04;

type Framing = {
  cameraZ: number;
  fov: number;
  radiusX: number;
  radiusZ: number;
  minScale: number;
  maxScale: number;
  spread: number;
};

type Slot = {
  side: -1 | 1;
  u: number;
  imageIndex: number;
};

function getFraming(width: number, height: number): Framing {
  const aspect = width / Math.max(height, 1);
  const portrait = aspect < 0.85;
  const spread = portrait ? 1.05 : 1.22;
  const radiusZ = portrait ? 2.8 : 3.5;
  const edgeZ = -Math.cos(spread) * radiusZ;
  const edgeDist = OFF_CAM_Z - edgeZ;
  const halfH = Math.tan(((OFF_FOV * Math.PI) / 180) / 2) * edgeDist;
  const halfW = halfH * aspect;
  const maxScale = (halfH * 1.35) / PLANE_H;
  const minScale = maxScale * 0.22;
  const radiusX = (halfW * 0.96) / Math.max(Math.sin(spread), 0.2);
  return {
    cameraZ: OFF_CAM_Z,
    fov: OFF_FOV,
    radiusX,
    radiusZ,
    minScale,
    maxScale,
    spread,
  };
}

function initSlots(): Slot[] {
  const slots: Slot[] = [];
  let imageIndex = 0;
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < PLANES_PER_SIDE; i++) {
      slots.push({
        side,
        u: (i + 0.5) / PLANES_PER_SIDE,
        imageIndex: imageIndex++ % IMAGE_COUNT,
      });
    }
  }
  return slots;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = w / h;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = img.naturalWidth;
  let sourceHeight = img.naturalHeight;

  if (imgRatio > canvasRatio) {
    sourceWidth = img.naturalHeight * canvasRatio;
    sourceX = (img.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = img.naturalWidth / canvasRatio;
    sourceY = (img.naturalHeight - sourceHeight) / 2;
  }

  ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, x, y, w, h);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function buildTileTexture(
  img: HTMLImageElement,
  invert: boolean,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_W;
  canvas.height = TILE_H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2D canvas unavailable");
  drawImageCover(ctx, img, 0, 0, TILE_W, TILE_H);
  if (invert) {
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, TILE_W, TILE_H);
    ctx.globalCompositeOperation = "source-over";
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function posePlane(
  mesh: THREE.Mesh,
  side: -1 | 1,
  u: number,
  framing: Framing,
) {
  const theta = side * u * framing.spread;
  mesh.position.set(
    Math.sin(theta) * framing.radiusX,
    0,
    -Math.cos(theta) * framing.radiusZ,
  );
  mesh.rotation.set(0, Math.PI - theta, 0);
  const s = THREE.MathUtils.lerp(framing.minScale, framing.maxScale, u);
  mesh.scale.setScalar(s);
}

/** Photo planes — no ASCII here; they render into the field's target. */
function PlaneEmitter() {
  const { camera, size } = useThree();
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const slotsRef = useRef<Slot[]>(initSlots());
  const velocityU = useRef(0);
  const imagesRef = useRef<HTMLImageElement[] | null>(null);
  const texturesRef = useRef<THREE.CanvasTexture[] | null>(null);
  const [imagesReady, setImagesReady] = useState(false);
  const [textures, setTextures] = useState<THREE.CanvasTexture[] | null>(null);

  const themeLight = useThemeLight();
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(PLANE_W, PLANE_H),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    let disposed = false;
    Promise.all(IMAGE_SRCS.map(loadImage))
      .then((images) => {
        if (disposed) return;
        imagesRef.current = images;
        setImagesReady(true);
      })
      .catch(() => {
        /* Covers failed — leave the canvas empty; copy stays readable. */
      });

    return () => {
      disposed = true;
      imagesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!imagesReady || !imagesRef.current) return;
    const next = imagesRef.current.map((img) =>
      buildTileTexture(img, themeLight),
    );
    texturesRef.current = next;
    setTextures(next);
    return () => {
      texturesRef.current = null;
      for (const tex of next) tex.dispose();
    };
  }, [imagesReady, themeLight]);

  useEffect(() => {
    if (reducedMotion) return;
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate(self) {
        const v = self.getVelocity();
        if (!v) return;
        velocityU.current += v * VELOCITY_U_SCALE;
      },
    });
    return () => {
      st.kill();
    };
  }, [reducedMotion]);

  useFrame((_, dt) => {
    const framing = getFraming(size.width, size.height);
    const slots = slotsRef.current;
    const maps = texturesRef.current;

    if (!reducedMotion) {
      const delta = IDLE_U_PER_SEC * dt + velocityU.current;
      velocityU.current = 0;
      for (const slot of slots) {
        slot.u += delta;
        let guard = 0;
        while (slot.u > 1 && guard++ < 8) {
          slot.u -= 1;
          slot.imageIndex = (slot.imageIndex + 1) % IMAGE_COUNT;
        }
        while (slot.u < 0 && guard++ < 8) {
          slot.u += 1;
          slot.imageIndex =
            (slot.imageIndex - 1 + IMAGE_COUNT) % IMAGE_COUNT;
        }
      }
    }

    const meshes = meshRefs.current;
    for (let i = 0; i < PLANE_COUNT; i++) {
      const mesh = meshes[i];
      const slot = slots[i];
      if (!mesh || !slot) continue;
      posePlane(mesh, slot.side, slot.u, framing);
      const mat = mesh.material;
      if (maps && mat instanceof THREE.MeshBasicMaterial) {
        const tex = maps[slot.imageIndex];
        if (tex && mat.map !== tex) {
          mat.map = tex;
          mat.needsUpdate = true;
        }
      }
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = framing.fov;
      camera.position.set(0, 0, framing.cameraZ);
      camera.updateProjectionMatrix();
    }
  });

  if (!textures) return null;

  return (
    <group>
      {slotsRef.current.map((slot, i) => (
        <mesh
          key={i}
          ref={(node) => {
            meshRefs.current[i] = node;
          }}
          geometry={geometry}
          frustumCulled={false}
        >
          <meshBasicMaterial
            map={textures[slot.imageIndex]}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function TeamVanishingPlanes() {
  const [inView, setInView] = useState(false);
  const ink = useThemeInk();

  useEffect(() => {
    const el = document.getElementById("team");
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "20% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Canvas
      className="team_cylinder"
      frameloop={inView ? "always" : "never"}
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
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
      <AsciiField
        surface="team"
        ink={ink}
        fov={OFF_FOV}
        cameraPosition={[0, 0, OFF_CAM_Z]}
      >
        <PlaneEmitter />
      </AsciiField>
    </Canvas>
  );
}
