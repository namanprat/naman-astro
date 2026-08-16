import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  ARCHIVE_CONFIG,
  ARCHIVE_GLOBE_HEIGHT,
  ARCHIVE_GRID_CELL_SIZE,
  ARCHIVE_GRID_HEIGHT,
} from "../../lib/archive/archiveConfig";
import type { ArchiveSpan } from "../../content/archive";
import { rigState } from "../../lib/archive/rigState";
import {
  stereographicUnwrap,
  wrappedCellWorld,
  type Vec3,
} from "../../lib/archive/archiveLayout";

export type TileData = {
  index: number;
  globePos: Vec3;
  unwrapPos: Vec3;
  texture: THREE.Texture;
  w: number;
  h: number;
};

const _orb = new THREE.Vector3();
const _unwrap = new THREE.Vector3();
const _target = new THREE.Vector3();
const damp = THREE.MathUtils.damp;
const lerp = THREE.MathUtils.lerp;
const smooth = (t: number) => t * t * (3 - 2 * t);

type PosterTileProps = {
  data: TileData;
  textures: THREE.Texture[];
};

export default function PosterTile({ data }: PosterTileProps) {
  const { index, globePos, unwrapPos, texture, w, h } = data;
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, delta) => {
    const g = group.current;
    const material = mat.current;
    if (!g || !material) return;

    const m = rigState.morph;
    const eased = smooth(m);

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
    g.position.copy(_target);
    g.rotation.set(
      lerp(g.rotation.x, 0, eased),
      lerp(g.rotation.y, 0, eased),
      0,
    );
    if (material.map !== texture) material.map = texture;

    const targetScale = lerp(ARCHIVE_GLOBE_HEIGHT, ARCHIVE_GRID_HEIGHT, eased);
    const s = damp(g.scale.x, targetScale, 12, delta);
    g.scale.setScalar(s);
  });

  return (
    <group ref={group}>
      <mesh>
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

export function buildTileData(
  globePos: Vec3,
  index: number,
  texture: THREE.Texture,
  aspect: number,
  span: ArchiveSpan = "height",
): TileData {
  const { w, h } = planeSize(aspect, span);
  return {
    index,
    globePos,
    unwrapPos: stereographicUnwrap(globePos, ARCHIVE_CONFIG.sphereRadius),
    texture,
    w,
    h,
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
