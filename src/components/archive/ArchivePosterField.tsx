import { useMemo, useRef } from "react";
import { SWATCH_LIGHT } from "@/lib/site/siteColors";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import ArchiveRig from "./ArchiveRig";
import PosterTile, { buildTileData, type TileData } from "./PosterTile";
import {
  ARCHIVE_CONFIG,
  ARCHIVE_PRIMARY_FONT,
} from "@/lib/archive/archiveConfig";
import { ARCHIVE_ITEMS, type ArchiveSpan } from "@/content/archive";
import { fibonacciSpherePoints } from "@/lib/archive/archiveLayout";
import { rigState } from "@/lib/archive/rigState";
import { useArchiveMedia } from "@/lib/archive/useArchiveMedia";

export default function ArchivePosterField() {
  const sources = useArchiveMedia();
  const textMat = useRef<{ opacity: number } | null>(null);

  // By url, not by index: a source the device could not decode is dropped, so
  // position in the loaded list no longer lines up with the manifest.
  const spanByUrl = useMemo(
    () =>
      new Map<string, ArchiveSpan>(
        ARCHIVE_ITEMS.map((item) => [item.src, item.span ?? "height"]),
      ),
    [],
  );

  const tiles = useMemo<TileData[]>(() => {
    if (!sources.length) return [];

    const pts = fibonacciSpherePoints(
      ARCHIVE_CONFIG.tileCount,
      ARCHIVE_CONFIG.sphereRadius,
    );
    const globePositions: typeof rigState.globePositions = [];
    const tileTextureIndices: number[] = [];
    const built = pts.map((globePos, i) => {
      const texIdx = Math.floor(Math.random() * sources.length);
      const source = sources[texIdx]!;
      const aspect = source.height ? source.width / source.height : 1;
      const span = spanByUrl.get(source.url) ?? "height";
      globePositions.push(globePos);
      tileTextureIndices.push(texIdx);
      return buildTileData(globePos, i, source.texture, aspect, span);
    });
    rigState.globePositions = globePositions;
    rigState.tileTextureIndices = tileTextureIndices;
    return built;
  }, [sources, spanByUrl]);

  useFrame(() => {
    if (textMat.current) {
      textMat.current.opacity = 1 - rigState.morph;
    }
  });

  return (
    <>
      <ArchiveRig />
      <Text
        font={ARCHIVE_PRIMARY_FONT}
        fontSize={1.05}
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0]}
        renderOrder={0}
      >
        Archive
        <meshBasicMaterial
          ref={textMat}
          color={SWATCH_LIGHT}
          transparent
          opacity={1}
          depthTest
          depthWrite={false}
          toneMapped={false}
        />
      </Text>
      {tiles.map((t) => (
        <PosterTile key={t.index} data={t} />
      ))}
    </>
  );
}
