import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import ArchiveScene from "./ArchiveScene";
import ArchiveViewSwitcher from "./ArchiveViewSwitcher";
import { resetArchiveToOrbView } from "../../lib/archive/archiveView";
import "./Archive.css";

/**
 * The archive's own canvas. Perspective camera (ArchiveCameras sets
 * makeDefault); it owns the whole viewport.
 *
 * pointerEvents stays on: the orb's arcball drag and the grid pan both read
 * pointer events straight off the canvas.
 */
export default function ArchiveCanvas() {
  useEffect(() => {
    document.documentElement.classList.add("page-archive");
    // rigState is module-level, so a second visit in the same session would
    // otherwise resume mid-morph or mid-pan.
    resetArchiveToOrbView();
    return () => document.documentElement.classList.remove("page-archive");
  }, []);

  return (
    <div className="archive-stage">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <ArchiveScene />
      </Canvas>
      <ArchiveViewSwitcher />
    </div>
  );
}
