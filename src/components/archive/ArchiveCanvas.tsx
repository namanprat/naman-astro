import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import type { ArchiveItem } from "@/content/archive";
import ArchiveLightbox from "./ArchiveLightbox";
import ArchiveScene from "./ArchiveScene";
import { resetArchiveFocus } from "@/lib/archive/archiveFocus";
import { resetArchiveToOrbView } from "@/lib/archive/archiveView";

/**
 * The archive's own canvas. Perspective camera (ArchiveCameras sets
 * makeDefault); it owns the whole viewport.
 *
 * pointerEvents stays on: the orb's arcball drag and the grid pan both read
 * pointer events straight off the canvas, and a poster's click comes through
 * R3F's own event layer.
 *
 * View tabs are Astro (`archive.astro`); the lightbox is React because it has
 * to follow the focus store the scene writes to.
 */
export default function ArchiveCanvas({ items }: { items: ArchiveItem[] }) {
  useEffect(() => {
    resetArchiveToOrbView();
    resetArchiveFocus();
    return () => {
      resetArchiveFocus();
      document.documentElement.classList.remove("page-archive");
    };
  }, []);

  return (
    <>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <ArchiveScene items={items} />
      </Canvas>
      <ArchiveLightbox />
    </>
  );
}
