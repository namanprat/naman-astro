/**
 * Codrops Demo 1–style cylinder gallery behind Team copy.
 * Idle spin always runs; scroll velocity adds on top (no ease lag).
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { workItems } from "@/content/work";

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
/** px/s scroll velocity → radians (instant, no easing). */
const VELOCITY_SCALE = 0.000012;
/** Continuous idle spin (rad/s) so the strip keeps moving off-scroll. */
const IDLE_RAD_PER_SEC = 0.12;

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
  // Alpha so gap gutters stay see-through (section bg / page shows through).
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
  texture.wrapS = THREE.ClampToEdgeWrapping;
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
  // Circumferential image width; cylinder height follows 5:4 landscape.
  const imageArc = ((2 * Math.PI * radius) / IMAGE_COUNT) * (1 - gapRatio);
  return {
    radius,
    height: imageArc / TILE_ASPECT,
    cameraZ: isMobile ? 5.2 : isTablet ? 5.8 : 6.4,
    fov: isMobile ? 50 : 45,
  };
}

/** Strip transform. Was a leva panel; these are the values it was tuned to. */
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

export default function TeamCylinderCarousel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest(".team_wrap");
    if (!canvas || !(section instanceof HTMLElement)) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let disposed = false;
    let rafId = 0;
    let texture: THREE.CanvasTexture | null = null;
    let st: ScrollTrigger | null = null;
    let gapRatio = 0;
    let scrollRotY = 0;
    let lastTick = performance.now();
    let images: HTMLImageElement[] | null = null;
    let appliedGapPct = Number.NaN;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      // Transparent, so .team_wrap's `background-color: var(--background)` is the surface
      // you see. An opaque clear here covers the whole section and the theme
      // toggle has nothing visible left to change.
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const dims = getResponsiveDimensions(window.innerWidth, 0, STRIP.radius);
    const geometry = new THREE.CylinderGeometry(
      dims.radius,
      dims.radius,
      dims.height,
      RADIAL_SEGMENTS,
      1,
      true,
    );

    const material = new THREE.MeshBasicMaterial({
      map: null,
      side: THREE.DoubleSide,
      transparent: true,
      // Hard discard on gap pixels so you see cleanly through to .team_wrap bg
      alphaTest: 0.5,
      depthWrite: true,
    });

    const cylinder = new THREE.Mesh(geometry, material);
    scene.add(cylinder);
    camera.position.set(0, 0, dims.cameraZ);
    camera.lookAt(0, 0, 0);

    const applyStrip = () => {
      const next = getResponsiveDimensions(
        section.clientWidth || window.innerWidth,
        gapRatio,
        STRIP.radius,
      );
      const sx = next.radius / dims.radius;
      const sy = next.height / dims.height;
      cylinder.position.set(STRIP.posX, STRIP.posY, STRIP.posZ);
      cylinder.rotation.set(STRIP.rotX, STRIP.rotY + scrollRotY, STRIP.rotZ);
      cylinder.scale.set(sx * STRIP.scale, sy * STRIP.scale, sx * STRIP.scale);
    };

    const applyAtlas = (gapPct: number) => {
      if (!images) return;
      const gl = renderer.getContext() as WebGLRenderingContext;
      const { texture: atlas, gapRatio: ratio } = buildAtlasFromImages(
        gl,
        images,
        gapPct,
      );
      texture?.dispose();
      texture = atlas;
      gapRatio = ratio;
      appliedGapPct = gapPct;
      material.map = atlas;
      material.needsUpdate = true;
      resize();
    };

    const resize = () => {
      const width = section.clientWidth;
      const height = section.clientHeight;
      if (!width || !height) return;

      const next = getResponsiveDimensions(width, gapRatio, STRIP.radius);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = next.fov;
      camera.position.z = next.cameraZ;
      camera.updateProjectionMatrix();
      applyStrip();
    };

    const paint = () => {
      renderer.render(scene, camera);
    };

    const tick = () => {
      if (disposed) return;
      rafId = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - lastTick) / 1000, 0.05);
      lastTick = now;
      if (!reducedMotion) scrollRotY += IDLE_RAD_PER_SEC * dt;

      const nextGap = STRIP.gapPct;
      if (images && nextGap !== appliedGapPct) applyAtlas(nextGap);

      applyStrip();
      paint();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(section);

    Promise.all(IMAGE_SRCS.map(loadImage))
      .then((loaded) => {
        if (disposed) return;
        images = loaded;
        applyAtlas(STRIP.gapPct);
        paint();
        rafId = requestAnimationFrame(tick);

        if (reducedMotion) return;

        // Drive spin from any page scroll — not only while .team_wrap is on screen.
        st = ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate(self) {
            const v = self.getVelocity();
            if (!v) return;
            scrollRotY += v * VELOCITY_SCALE;
          },
        });
      })
      .catch(() => {
        // Atlas failed — leave black canvas; text still readable
      });

    resize();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      st?.kill();
      texture?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas className="team_cylinder" ref={canvasRef} aria-hidden="true" />
  );
}
