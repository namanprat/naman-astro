/**
 * Discrete portrait planes on a concave U-path, as an R3F island.
 *
 * Planes ride a concave U as one infinite row: small and far at center,
 * large and yawed at the edges. They wrap from one lip to the other so the
 * series never runs out. Glyphs come from the shared `AsciiField`.
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
/** One looping row — enough to read as a series, spaced so they stay separate. */
const PLANE_COUNT = 11;
/** Portrait tile — 3:4 width:height. */
const TILE_ASPECT = 3 / 4;
const TILE_W = 768;
const TILE_H = Math.round(TILE_W / TILE_ASPECT);
const PLANE_H = 1.2;
const PLANE_W = PLANE_H * TILE_ASPECT;
/** px/s scroll velocity → progress along the U. */
const VELOCITY_T_SCALE = 0.00003;
/** Idle crawl (progress/s) so the row keeps moving off-scroll. */
const IDLE_T_PER_SEC = 0.08;

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
    cameraZ: isMobile ? 5.8 : isTablet ? 6.4 : 6.8,
    fov: isMobile ? 48 : 42,
    radiusX: isMobile ? 3.2 : isTablet ? 4.4 : 5.4,
    radiusZ: isMobile ? 2.4 : isTablet ? 3.2 : 3.8,
    minScale: isMobile ? 0.42 : 0.4,
    maxScale: isMobile ? 1.05 : 1.15,
    spread: isMobile ? 1.12 : 1.28,
  };
}

function initProgress(): Float32Array {
  const t = new Float32Array(PLANE_COUNT);
  for (let i = 0; i < PLANE_COUNT; i++) {
    t[i] = -1 + ((i + 0.5) / PLANE_COUNT) * 2;
  }
  return t;
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
  const progress = useRef(initProgress());
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
      const t = progress.current;
      for (let i = 0; i < t.length; i++) {
        let next = t[i] + delta;
        if (next > 1) next -= 2;
        else if (next < -1) next += 2;
        t[i] = next;
      }
    }

    const meshes = meshRefs.current;
    const t = progress.current;
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
