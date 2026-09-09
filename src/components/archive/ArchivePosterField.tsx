import { useMemo, useRef } from "react";
import { SWATCH_LIGHT } from "@/lib/site/webgl/siteColors";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import ArchiveRig from "./ArchiveRig";
import PosterTile, { buildTileData, type TileData } from "./PosterTile";
import { ARCHIVE_PRIMARY_FONT } from "@/lib/archive/archiveConfig";
import type { ArchiveItem } from "@/content/archive";
import { archiveFocusDim } from "@/lib/archive/archiveFocus";
import { planArchiveTiles } from "@/lib/archive/archiveTilePlan";
import { rigState } from "@/lib/archive/rigState";
import { useArchiveMedia } from "@/lib/archive/useArchiveMedia";

export default function ArchivePosterField({
  items,
}: {
  items: ArchiveItem[];
}) {
  const sources = useArchiveMedia(items.map((item) => item.src));
  const textMat = useRef<{ opacity: number } | null>(null);

  // By url, not by index: a source the device could not decode is dropped, so
  // position in the loaded list no longer lines up with the manifest.
  const itemByUrl = useMemo(
    () => new Map<string, ArchiveItem>(items.map((item) => [item.src, item])),
    [items],
  );

  const tiles = useMemo<TileData[]>(() => {
    if (!sources.length) return [];

    const globePositions: typeof rigState.globePositions = [];
    const tileTextureIndices: number[] = [];

    /* `planArchiveTiles` owns the no-duplicates rule and the orb/filler split;
       this loop only hangs a texture and a plane size off each entry. */
    const built = planArchiveTiles(sources.length).map(
      ({ index, textureIndex, globePos, isFiller }) => {
        const source = sources[textureIndex]!;
        const item = itemByUrl.get(source.url) ?? null;
        const aspect = source.height ? source.width / source.height : 1;

        globePositions.push(globePos);
        tileTextureIndices.push(textureIndex);

        return buildTileData(globePos, index, source.texture, aspect, {
          span: item?.span ?? "height",
          isFiller,
          item,
        });
      },
    );

    rigState.globePositions = globePositions;
    rigState.tileTextureIndices = tileTextureIndices;
    return built;
  }, [sources, itemByUrl]);

  useFrame(() => {
    if (textMat.current) {
      // Fades out into the grid, and again behind an opened poster.
      textMat.current.opacity = (1 - rigState.morph) * (1 - archiveFocusDim());
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
