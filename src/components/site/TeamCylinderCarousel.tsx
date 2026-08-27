/**
 * Discrete portrait planes on a concave U-path, as an R3F island.
 *
 * Planes spawn at the screen center (small, far) and travel to the left and
 * right edges (large, near). Glyphs come from the shared `AsciiField` — same
 * treatment as the About bust and the Process cards.
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

/** Work covers plus detail stills so the row reads wide, not sparse. */
const IMAGE_SRCS = [
  ...workItems.map((item) => item.image),
  "/work/haptic/haptic-hero.webp",
  "/work/money-me/money-cover.webp",
];
const IMAGE_COUNT = IMAGE_SRCS.length;
/** Two of each cover so the U stays packed while tiles recycle. */
const PLANE_COUNT = IMAGE_COUNT * 2;
/** Portrait tile — 3:4 width:height. */
const TILE_ASPECT = 3 / 4;
const TILE_W = 768;
const TILE_H = Math.round(TILE_W / TILE_ASPECT);
const PLANE_H = 1.7;
const PLANE_W = PLANE_H * TILE_ASPECT;
/** px/s scroll velocity → progress along the U. */
const VELOCITY_T_SCALE = 0.00003;
/** Idle crawl (progress/s) so tiles keep leaving the center off-scroll. */
const IDLE_T_PER_SEC = 0.11;

type Framing = {
  cameraZ: number;
  fov: number;
  radiusX: number;
  radiusZ: number;
  minScale: number;
  maxScale: number;
  spread: number;
};

function getFraming(width: number): Framing {
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  return {
    cameraZ: isMobile ? 5.6 : isTablet ? 6.2 : 6.5,
    fov: isMobile ? 48 : 45,
    radiusX: isMobile ? 2.8 : isTablet ? 3.8 : 4.5,
    radiusZ: isMobile ? 2.2 : isTablet ? 3.0 : 3.5,
    minScale: isMobile ? 0.5 : 0.48,
    maxScale: isMobile ? 1.28 : 1.45,
    spread: isMobile ? 1.0 : 1.18,
  };
}

function initProgress(): { t: Float32Array; signs: Float32Array } {
  const t = new Float32Array(PLANE_COUNT);
  const signs = new Float32Array(PLANE_COUNT);
  const half = Math.ceil(PLANE_COUNT / 2);
  for (let i = 0; i < PLANE_COUNT; i++) {
    const lane = Math.floor(i / 2);
    const absT = Math.pow((lane + 0.15) / half, 0.72) * 0.94;
    const sign = i % 2 === 0 ? 1 : -1;
    signs[i] = sign;
    t[i] = sign * absT;
  }
  return { t, signs };
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

function posePlane(mesh: THREE.Mesh, t: number, framing: Framing) {
  const theta = t * framing.spread;
  mesh.position.set(
    Math.sin(theta) * framing.radiusX,
    0,
    -Math.cos(theta) * framing.radiusZ,
  );
  mesh.rotation.set(0, Math.PI - theta, 0);
  const s = THREE.MathUtils.lerp(
    framing.minScale,
    framing.maxScale,
    Math.abs(t),
  );
  mesh.scale.setScalar(s);
}

/** Photo planes — no ASCII here; they render into the field's target. */
function PlaneStrip() {
  const { camera, size } = useThree();
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const path = useRef(initProgress());
  const velocityT = useRef(0);
  const imagesRef = useRef<HTMLImageElement[] | null>(null);
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
    setTextures(next);
    return () => {
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
        velocityT.current += v * VELOCITY_T_SCALE;
      },
    });
    return () => {
      st.kill();
    };
  }, [reducedMotion]);

  useFrame((_, dt) => {
    const framing = getFraming(size.width);
    if (!reducedMotion) {
      const delta = IDLE_T_PER_SEC * dt + velocityT.current;
      velocityT.current = 0;
      const { t, signs } = path.current;
      for (let i = 0; i < t.length; i++) {
        const sign = signs[i] ?? 1;
        let next = t[i] + sign * delta;
        if (next * sign > 1) next = sign * 0.08;
        else if (next * sign < 0) next = sign * 0.08;
        t[i] = next;
      }
    }

    const meshes = meshRefs.current;
    const t = path.current.t;
    for (let i = 0; i < PLANE_COUNT; i++) {
      const mesh = meshes[i];
      if (mesh) posePlane(mesh, t[i] ?? 0, framing);
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
      {Array.from({ length: PLANE_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(node) => {
            meshRefs.current[i] = node;
          }}
          geometry={geometry}
          frustumCulled={false}
        >
          <meshBasicMaterial
            map={textures[i % IMAGE_COUNT]}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function TeamCylinderCarousel() {
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
        fov={45}
        cameraPosition={[0, 0, 6.5]}
      >
        <PlaneStrip />
      </AsciiField>
    </Canvas>
  );
}
