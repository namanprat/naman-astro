import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import type { ArchiveItem } from "@/content/archive";
import ArchiveScene from "./ArchiveScene";
import { resetArchiveToOrbView } from "@/lib/archive/archiveView";

/**
 * The archive's own canvas. Perspective camera (ArchiveCameras sets
 * makeDefault); it owns the whole viewport.
 *
 * pointerEvents stays on: the orb's arcball drag and the grid pan both read
 * pointer events straight off the canvas.
 *
 * View tabs are Astro (`archive.astro`) so this file is R3F only.
 */
export default function ArchiveCanvas({ items }: { items: ArchiveItem[] }) {
  useEffect(() => {
    resetArchiveToOrbView();
    return () => document.documentElement.classList.remove("page-archive");
  }, []);

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <ArchiveScene items={items} />
    </Canvas>
  );
}
