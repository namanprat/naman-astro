/**
 * Codrops Demo 1–style cylinder behind Team copy, as an R3F island.
 *
 * The cylinder is now a plain photo-textured mesh that spins; the glyphs come
 * from the shared `AsciiField`, so the lattice sits flat on screen and the ring
 * turns beneath it — the same treatment as the About bust and the Process cards.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { workItems } from "@/content/work";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { useThemeInk } from "@/lib/site/ascii/useThemeInk";
import AsciiField from "./ascii/AsciiField";

gsap.registerPlugin(ScrollTrigger);

/** Work covers plus detail stills so the ring reads wide, not sparse. */
const IMAGE_SRCS = [
  ...workItems.map((item) => item.image),
  "/work/haptic/haptic-hero.webp",
  "/work/money-me/money-cover.webp",
];
const IMAGE_COUNT = IMAGE_SRCS.length;
/** Landscape tile — 5:4 width:height. */
const TILE_ASPECT = 5 / 4;
const TILE_W = 1280;
const TILE_H = Math.round(TILE_W / TILE_ASPECT);
/** Default gap between tiles as % of tile width. */
const DEFAULT_GAP_PCT = 3.5;
const RADIAL_SEGMENTS = 64;
/** Full turn in radians — maps mesh spin constants onto UV 0–1. */
const TAU = Math.PI * 2;
/** px/s scroll velocity → UV (same feel as the old 0.000012 rad scale). */
const VELOCITY_UV_SCALE = 0.000012 / TAU;
/** Continuous idle crawl (UV/s) so the strip keeps moving off-scroll. */
const IDLE_UV_PER_SEC = 0.12 / TAU;
/** Glyph rows across the short axis. Denser than the old 35-cell UV lattice. */
const ASCII_DENSITY = 56;
const ASCII_NOISE = 1;
/** Extra mesh scale below 768px so the oval fits a phone viewport. */
const MOBILE_SCALE = 0.75;

/** Strip transform. Pose is fixed apart from the scroll-driven spin. */
const STRIP = {
  posX: 0,
  posY: 1.1,
  posZ: 0,
  rotX: 0,
  rotY: 0,
  rotZ: -0.1,
  scale: 1,
  radius: 1.7,
  gapPct: DEFAULT_GAP_PCT,
};

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

function buildAtlasFromImages(
  gl: WebGLRenderingContext,
  images: HTMLImageElement[],
  gapPct: number,
): { texture: THREE.CanvasTexture; gapRatio: number } {
  const hardwareLimit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const isMobile = window.innerWidth < 768;
  const safeLimit = isMobile ? 2048 : Math.min(hardwareLimit, 8192);

  const gap = Math.max(0, Math.round((TILE_W * gapPct) / 100));
  const slot = TILE_W + gap;
  const totalWidthOriginal = slot * images.length;
  const scale = Math.min(1, safeLimit / totalWidthOriginal);

  const atlas = document.createElement("canvas");
  atlas.width = Math.max(1, Math.floor(totalWidthOriginal * scale));
  atlas.height = Math.max(1, Math.floor(TILE_H * scale));
  const ctx = atlas.getContext("2d", {
    alpha: true,
    willReadFrequently: false,
  });
  if (!ctx) throw new Error("2D canvas unavailable");

  ctx.clearRect(0, 0, atlas.width, atlas.height);

  const scaledSlot = atlas.width / images.length;
  const scaledTile = scaledSlot * (TILE_W / slot);
  const totalH = atlas.height;

  images.forEach((img, i) => {
    const xPos = Math.floor(i * scaledSlot);
    const drawW = Math.floor(scaledTile);
    drawImageCover(ctx, img, xPos, 0, drawW, totalH);
  });

  const texture = new THREE.CanvasTexture(atlas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return { texture, gapRatio: gap / slot };
}

function getResponsiveDimensions(
  width: number,
  gapRatio: number,
  radiusOverride?: number,
) {
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const radius = radiusOverride ?? (isMobile ? 1.4 : isTablet ? 1.55 : 1.7);
  const imageArc = ((2 * Math.PI * radius) / IMAGE_COUNT) * (1 - gapRatio);
  return {
    radius,
    height: imageArc / TILE_ASPECT,
    cameraZ: isMobile ? 5.2 : isTablet ? 5.8 : 6.4,
    fov: isMobile ? 50 : 45,
  };
}

/** The photo ring itself — no ASCII here, it renders into the field's target. */
function CylinderStrip() {
  const { camera, gl, size } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const scrollUv = useRef(0);
  const velocityUv = useRef(0);
  const photoTex = useRef<THREE.CanvasTexture | null>(null);
  const imagesRef = useRef<HTMLImageElement[] | null>(null);
  const [imagesReady, setImagesReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [gapRatio, setGapRatio] = useState(0);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const baseDims = useMemo(
    () => getResponsiveDimensions(size.width || 1024, 0, STRIP.radius),
    [size.width],
  );

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
      photoTex.current?.dispose();
      photoTex.current = null;
      imagesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!imagesReady || !imagesRef.current) return;
    const ctx = gl.getContext() as WebGLRenderingContext;
    const photo = buildAtlasFromImages(ctx, imagesRef.current, STRIP.gapPct);
    photoTex.current?.dispose();
    photoTex.current = photo.texture;
    setTexture(photo.texture);
    setGapRatio(photo.gapRatio);
    setReady(true);
  }, [imagesReady, gl]);

  useEffect(() => {
    if (reducedMotion) return;
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate(self) {
        const v = self.getVelocity();
        if (!v) return;
        velocityUv.current += v * VELOCITY_UV_SCALE;
      },
    });
    return () => {
      st.kill();
    };
  }, [reducedMotion]);

  useFrame((_, dt) => {
    if (!reducedMotion) {
      scrollUv.current += IDLE_UV_PER_SEC * dt + velocityUv.current;
      velocityUv.current = 0;
      scrollUv.current = ((scrollUv.current % 1) + 1) % 1;
    }

    const mesh = meshRef.current;
    if (!mesh) return;

    const next = getResponsiveDimensions(size.width, gapRatio, STRIP.radius);
    const sx = next.radius / baseDims.radius;
    const sy = next.height / baseDims.height;
    mesh.position.set(STRIP.posX, STRIP.posY, STRIP.posZ);
    // ponytail: the glyph lattice no longer travels with the UVs, so the whole
    // ring turns instead — scroll feeds the same spin the UVs used to carry.
    const spinY = !reducedMotion ? scrollUv.current * TAU : 0;
    mesh.rotation.set(STRIP.rotX, STRIP.rotY + spinY, STRIP.rotZ);
    const viewportScale = size.width < 768 ? MOBILE_SCALE : 1;
    mesh.scale.set(
      sx * STRIP.scale * viewportScale,
      sy * STRIP.scale * viewportScale,
      sx * STRIP.scale * viewportScale,
    );

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = next.fov;
      camera.position.z = next.cameraZ;
      camera.updateProjectionMatrix();
    }
  });

  if (!ready || !texture) return null;

  return (
    <mesh ref={meshRef}>
      <cylinderGeometry
        args={[
          baseDims.radius,
          baseDims.radius,
          baseDims.height,
          RADIAL_SEGMENTS,
          1,
          true,
        ]}
      />
      <meshBasicMaterial
        map={texture}
        side={THREE.DoubleSide}
        transparent
        toneMapped={false}
      />
    </mesh>
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
        density={ASCII_DENSITY}
        ink={ink}
        noise={ASCII_NOISE}
        fov={45}
        cameraPosition={[0, 0, 6.4]}
      >
        <CylinderStrip />
      </AsciiField>
    </Canvas>
  );
}
