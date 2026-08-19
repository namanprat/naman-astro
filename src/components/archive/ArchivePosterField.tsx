import { useMemo, useRef } from "react";
import { SWATCH_LIGHT } from "../../lib/site/siteColors";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import ArchiveRig from "./ArchiveRig";
import PosterTile, { buildTileData, type TileData } from "./PosterTile";
import {
  ARCHIVE_CONFIG,
  ARCHIVE_PRIMARY_FONT,
} from "../../lib/archive/archiveConfig";
import { fibonacciSpherePoints } from "../../lib/archive/archiveLayout";
import { rigState } from "../../lib/archive/rigState";
import { useArchiveMedia } from "../../lib/archive/useArchiveMedia";

export default function ArchivePosterField() {
  const sources = useArchiveMedia();
  const textMat = useRef<{ opacity: number } | null>(null);

  const tiles = useMemo<TileData[]>(() => {
    if (!sources.length) return [];

    const pts = fibonacciSpherePoints(
      ARCHIVE_CONFIG.tileCount,
      ARCHIVE_CONFIG.sphereRadius,
    );
    const globePositions: typeof rigState.globePositions = [];
    const built = pts.map((globePos, i) => {
      /* Aspect and span both ride on the source. Reading `span` out of
         ARCHIVE_ITEMS by this index only held while the loaded array matched
         the manifest one-for-one, which stopped being true the moment a failed
         asset could be dropped. */
      const source = sources[Math.floor(Math.random() * sources.length)]!;
      const aspect = source.height ? source.width / source.height : 1;
      globePositions.push(globePos);
      return buildTileData(globePos, i, source.texture, aspect, source.span);
    });
    rigState.globePositions = globePositions;
    return built;
  }, [sources]);

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
