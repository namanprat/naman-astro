import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  ARCHIVE_CONFIG,
  ARCHIVE_GLOBE_HEIGHT,
  ARCHIVE_GRID_CELL_SIZE,
  ARCHIVE_GRID_HEIGHT,
} from "@/lib/archive/archiveConfig";
import type { ArchiveItem, ArchiveSpan } from "@/content/archive";
import {
  archiveFocusDim,
  closeArchiveFocus,
  openArchiveFocus,
} from "@/lib/archive/archiveFocus";
import { rigState } from "@/lib/archive/rigState";
import {
  stereographicUnwrap,
  wrappedCellWorld,
  type Vec3,
} from "@/lib/archive/archiveLayout";

export type TileData = {
  index: number;
  globePos: Vec3;
  unwrapPos: Vec3;
  texture: THREE.Texture;
  w: number;
  h: number;
  /**
   * Grid-only tile — invisible in orb view, faded in by the morph. The orb
   * shows one tile per archive item; these exist so the grid keeps its density.
   */
  isFiller: boolean;
  /** The archive entry behind this tile, for the lightbox caption. */
  item: ArchiveItem | null;
};

const _orb = new THREE.Vector3();
const _unwrap = new THREE.Vector3();
const _target = new THREE.Vector3();
const _focus = new THREE.Vector3();
const damp = THREE.MathUtils.damp;
const lerp = THREE.MathUtils.lerp;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** How far an unfocused tile is darkened while the lightbox is open. */
const DIMMED = 0.15;

type PosterTileProps = {
  data: TileData;
};

export default function PosterTile({ data }: PosterTileProps) {
  const { index, globePos, unwrapPos, texture, w, h, isFiller, item } = data;
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const gl = useThree((state) => state.gl);

  useFrame((_, delta) => {
    const g = group.current;
    const material = mat.current;
    if (!g || !material) return;

    const m = rigState.morph;
    const eased = smooth(m);

    /* Filler tiles ride the morph in and out. `depthWrite` has to follow, or a
       fully transparent tile still writes depth and punches a poster-shaped
       hole in whatever is behind it; `visible` keeps them out of the raycaster
       so they can never be clicked in orb view. */
    const alpha = isFiller ? eased : 1;
    material.opacity = alpha;
    material.depthWrite = alpha > 0.99;
    g.visible = alpha > 0.001;
    if (!g.visible) return;

    _orb
      .set(globePos.x, globePos.y, globePos.z)
      .applyQuaternion(rigState.orientation);
    // Grid target = home cell wrapped to the copy nearest the viewport, so the
    // grid loops infinitely in both axes as you pan (camera fixed, images move).
    // Same value drives the morph path and the settle, so the m=0.98 boundary is
    // continuous even when the grid was panned before exiting.
    const cell = rigState.tileGridCells[index];
    if (cell) {
      const wp = wrappedCellWorld(
        cell,
        rigState.gridPan.x,
        rigState.gridPan.y,
        ARCHIVE_GRID_CELL_SIZE,
      );
      _unwrap.set(wp.x, wp.y, wp.z);
    } else {
      _unwrap.set(unwrapPos.x, unwrapPos.y, unwrapPos.z);
    }

    if (m > 0.98) {
      g.position.copy(_unwrap);
      if (material.map !== texture) material.map = texture;
      if (texture.anisotropy < 4) texture.anisotropy = 4;
      g.rotation.set(0, 0, 0);
      const gs = damp(g.scale.x, ARCHIVE_GRID_HEIGHT, 12, delta);
      g.scale.setScalar(gs);
      return;
    }

    _target.copy(_orb).lerp(_unwrap, eased);
    g.rotation.set(
      lerp(g.rotation.x, 0, eased),
      lerp(g.rotation.y, 0, eased),
      0,
    );
    if (material.map !== texture) material.map = texture;

    let targetScale = lerp(ARCHIVE_GLOBE_HEIGHT, ARCHIVE_GRID_HEIGHT, eased);

    /* The orb recedes into the dark behind the opened poster. `color`
       multiplies the map on a basic material, so this dims the image without
       touching its opacity — fading it instead would let the grid backdrop
       show straight through the posters. */
    const dim = rigState.focusIndex === index ? 0 : archiveFocusDim();
    material.color.setScalar(dim > 0 ? lerp(1, DIMMED, dim) : 1);

    /* Lightbox: blend off the tile's live orb transform toward a spot in front
       of the whole sphere, so plain depth testing draws it over the orb. Raw
       `focusT` — GSAP already eased it with `hop`, and smoothing it again here
       would flatten that curve. */
    const f = rigState.focusIndex === index ? rigState.focusT : 0;
    if (f > 0) {
      _focus.set(0, ARCHIVE_CONFIG.focusYOffset, ARCHIVE_CONFIG.focusZ);
      _target.lerp(_focus, f);
      targetScale = lerp(targetScale, ARCHIVE_CONFIG.focusHeight, f);
      if (texture.anisotropy < 4) texture.anisotropy = 4;
    }

    g.position.copy(_target);
    const s = damp(g.scale.x, targetScale, 12, delta);
    g.scale.setScalar(s);
  });

  /** Orb view, settled — the only state in which a poster is clickable. */
  const orbMode = () => rigState.morph < 0.05 && !rigState.isMorphing;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (isFiller || !item || !orbMode()) return;
    // The gesture that just ended was a drag across the orb, not a tap.
    if (rigState.wasDrag) return;
    e.stopPropagation();
    if (rigState.focusIndex === index) closeArchiveFocus();
    else openArchiveFocus(index, item);
  };

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (isFiller || !item || !orbMode()) return;
    e.stopPropagation();
    rigState.hoverTiles += 1;
    if (rigState.focusIndex < 0) gl.domElement.style.cursor = "pointer";
  };

  const onPointerOut = () => {
    if (isFiller || !item) return;
    rigState.hoverTiles = Math.max(0, rigState.hoverTiles - 1);
    if (rigState.hoverTiles === 0 && !rigState.isDragging) {
      gl.domElement.style.cursor = orbMode() ? "grab" : "default";
    }
  };

  return (
    /* Seeded at the orb size rather than three.js's default 1: a filler tile is
       invisible until the morph, so its first visible frame would otherwise
       damp up from the wrong scale. */
    <group ref={group} scale={ARCHIVE_GLOBE_HEIGHT}>
      <mesh
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          ref={mat}
          map={texture}
          transparent
          depthWrite
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

type BuildTileOptions = {
  span?: ArchiveSpan;
  isFiller?: boolean;
  item?: ArchiveItem | null;
};

export function buildTileData(
  globePos: Vec3,
  index: number,
  texture: THREE.Texture,
  aspect: number,
  { span = "height", isFiller = false, item = null }: BuildTileOptions = {},
): TileData {
  const { w, h } = planeSize(aspect, span);
  return {
    index,
    globePos,
    unwrapPos: stereographicUnwrap(globePos, ARCHIVE_CONFIG.sphereRadius),
    texture,
    w,
    h,
    isFiller,
    item,
  };
}

function planeSize(
  aspect: number,
  span: ArchiveSpan,
): { w: number; h: number } {
  const ratio = Math.max(aspect, 1e-6);
  switch (span) {
    case "width":
      return { w: 1, h: 1 / ratio };
    case "height":
      return { w: ratio, h: 1 };
    default: {
      const _exhaustive: never = span;
      return _exhaustive;
    }
  }
}
