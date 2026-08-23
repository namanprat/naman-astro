/**
 * Codrops Demo 1–style cylinder behind Team copy, as an R3F island.
 * Mesh pose is fixed; Duforn glyphs scroll in the shader. Ink is `--text`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { folder, useControls } from "leva";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { workItems } from "@/content/work";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import {
  ASCII_FRAG,
  ASCII_VERT,
  buildDufornAsciiAtlas,
  readThemeInk,
} from "./teamCylinderAscii";

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
const ASCII_GRANULARITY = 24;

/** Strip transform. Pose is fixed; only the shader UVs travel. */
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

type StripControls = {
  granularity: number;
  fontSize: number;
  noise: number;
  scrollSpeed: number;
  idleSpeed: number;
  scrollBoost: number;
  moveCylinder: boolean;
  posY: number;
  rotZ: number;
  scale: number;
  radius: number;
  gapPct: number;
};

function TeamCylinderScene({ controls }: { controls: StripControls }) {
  const { camera, gl, size } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const scrollUv = useRef(0);
  const velocityUv = useRef(0);
  const photoTex = useRef<THREE.CanvasTexture | null>(null);
  const asciiTex = useRef<THREE.CanvasTexture | null>(null);
  const imagesRef = useRef<HTMLImageElement[] | null>(null);
  const velocityScaleRef = useRef(controls.scrollBoost);
  velocityScaleRef.current = controls.scrollBoost;
  const [imagesReady, setImagesReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [gapRatio, setGapRatio] = useState(0);

  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const baseDims = useMemo(
    () => getResponsiveDimensions(size.width || 1024, 0, controls.radius),
    [size.width, controls.radius],
  );

  const uniforms = useMemo(
    () => ({
      uTexture: { value: null as THREE.Texture | null },
      uAsciiTexture: { value: null as THREE.Texture | null },
      uGlyphCount: { value: 1 },
      uGranularity: { value: ASCII_GRANULARITY },
      uFontSize: { value: 1 },
      uSurfaceAspect: { value: IMAGE_COUNT * TILE_ASPECT },
      uColor: { value: new THREE.Color("#8b8b8b") },
      uTime: { value: 0 },
      uNoise: { value: reducedMotion ? 0 : 1 },
      uScroll: { value: 0 },
    }),
    [reducedMotion],
  );

  useEffect(() => {
    let disposed = false;
    Promise.all([
      Promise.all(IMAGE_SRCS.map(loadImage)),
      buildDufornAsciiAtlas(),
    ])
      .then(([images, ascii]) => {
        if (disposed) {
          ascii.texture.dispose();
          return;
        }
        imagesRef.current = images;
        asciiTex.current = ascii.texture;
        uniforms.uAsciiTexture.value = ascii.texture;
        uniforms.uGlyphCount.value = ascii.glyphCount;
        uniforms.uColor.value.set(readThemeInk());
        setImagesReady(true);
      })
      .catch(() => {
        /* Atlas failed — leave the canvas empty; copy stays readable. */
      });

    return () => {
      disposed = true;
      photoTex.current?.dispose();
      asciiTex.current?.dispose();
      photoTex.current = null;
      asciiTex.current = null;
      imagesRef.current = null;
    };
  }, [uniforms]);

  useEffect(() => {
    if (!imagesReady || !imagesRef.current) return;
    const ctx = gl.getContext() as WebGLRenderingContext;
    const photo = buildAtlasFromImages(ctx, imagesRef.current, controls.gapPct);
    photoTex.current?.dispose();
    photoTex.current = photo.texture;
    uniforms.uTexture.value = photo.texture;
    setGapRatio(photo.gapRatio);
    setReady(true);
  }, [imagesReady, controls.gapPct, gl, uniforms]);

  useEffect(() => {
    if (reducedMotion) return;
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate(self) {
        const v = self.getVelocity();
        if (!v) return;
        velocityUv.current += v * VELOCITY_UV_SCALE * velocityScaleRef.current;
      },
    });
    return () => {
      st.kill();
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!ready) return;
    const color = uniforms.uColor.value;
    const apply = () => {
      color.set(readThemeInk());
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => mo.disconnect();
  }, [ready, uniforms]);

  useFrame((_, dt) => {
    if (!reducedMotion) {
      scrollUv.current +=
        controls.idleSpeed * controls.scrollSpeed * dt + velocityUv.current;
      velocityUv.current = 0;
      scrollUv.current = ((scrollUv.current % 1) + 1) % 1;
    }

    const mesh = meshRef.current;
    if (!mesh) return;

    const next = getResponsiveDimensions(size.width, gapRatio, controls.radius);
    const sx = next.radius / baseDims.radius;
    const sy = next.height / baseDims.height;
    mesh.position.set(STRIP.posX, controls.posY, STRIP.posZ);
    const spinY =
      !reducedMotion && controls.moveCylinder ? scrollUv.current * TAU : 0;
    mesh.rotation.set(STRIP.rotX, STRIP.rotY + spinY, controls.rotZ);
    mesh.scale.set(
      sx * controls.scale,
      sy * controls.scale,
      sx * controls.scale,
    );

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = next.fov;
      camera.position.z = next.cameraZ;
      camera.updateProjectionMatrix();
    }

    const mat = materialRef.current;
    if (!mat) return;
    mat.uniforms.uGranularity.value = controls.granularity;
    mat.uniforms.uFontSize.value = controls.fontSize ?? 1;
    mat.uniforms.uNoise.value = reducedMotion ? 0 : controls.noise;
    mat.uniforms.uScroll.value = scrollUv.current;
    if (!reducedMotion) mat.uniforms.uTime.value += dt;
    const safeGap = Math.min(gapRatio, 0.95);
    mat.uniforms.uSurfaceAspect.value =
      (IMAGE_COUNT * TILE_ASPECT) / (1 - safeGap);
  });

  if (!ready) return null;

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
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={ASCII_VERT}
        fragmentShader={ASCII_FRAG}
        side={THREE.DoubleSide}
        transparent
        depthWrite
        toneMapped={false}
      />
    </mesh>
  );
}

export default function TeamCylinderCarousel() {
  const controls = useControls({
    moveCylinder: { value: true, label: "Move cylinder" },
    ASCII: folder({
      granularity: {
        value: ASCII_GRANULARITY,
        min: 4,
        max: 64,
        step: 1,
      },
      fontSize: { value: 1, min: 0.4, max: 3, step: 0.05 },
      noise: { value: 1, min: 0, max: 1, step: 0.01 },
      scrollSpeed: { value: 1, min: 0, max: 4, step: 0.05 },
    }),
    Motion: folder({
      idleSpeed: {
        value: IDLE_UV_PER_SEC,
        min: 0,
        max: 0.12,
        step: 0.001,
      },
      scrollBoost: {
        value: 1,
        min: 0,
        max: 8,
        step: 0.05,
      },
    }),
    Strip: folder({
      posY: { value: STRIP.posY, min: -1, max: 3, step: 0.05 },
      rotZ: { value: STRIP.rotZ, min: -0.6, max: 0.6, step: 0.01 },
      scale: { value: STRIP.scale, min: 0.4, max: 2, step: 0.05 },
      radius: { value: STRIP.radius, min: 0.8, max: 3, step: 0.05 },
      gapPct: { value: STRIP.gapPct, min: 0, max: 20, step: 0.5 },
    }),
  });

  return (
    <Canvas
      className="team_cylinder"
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
      camera={{ position: [0, 0, 6.4], fov: 45, near: 0.1, far: 100 }}
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
      <TeamCylinderScene controls={controls} />
    </Canvas>
  );
}
