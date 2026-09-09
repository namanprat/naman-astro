import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import type { ArchiveItem } from "@/content/archive";
import type { ViewItem } from "@/lib/content/models";
import ArchiveScene from "./ArchiveScene";
import ViewSwitcher, { type ViewSwitcherItem } from "../ViewSwitcher";
import {
  resetArchiveToOrbView,
  setArchiveView,
  useArchiveView,
  type ArchiveView,
} from "@/lib/archive/archiveView";
import "./Archive.css";

const DEFAULT_ARCHIVE_VIEWS: readonly ViewSwitcherItem<ArchiveView>[] = [
  { id: "orb", label: "Orb" },
  { id: "grid", label: "Grid" },
];

function archiveViewsFrom(
  views: readonly ViewItem[] | undefined,
): readonly ViewSwitcherItem<ArchiveView>[] {
  const next = (views ?? []).filter(
    (view): view is ViewSwitcherItem<ArchiveView> =>
      view.id === "orb" || view.id === "grid",
  );
  return next.length ? next : DEFAULT_ARCHIVE_VIEWS;
}

/**
 * The archive's own canvas. Perspective camera (ArchiveCameras sets
 * makeDefault); it owns the whole viewport.
 *
 * pointerEvents stays on: the orb's arcball drag and the grid pan both read
 * pointer events straight off the canvas.
 */
export default function ArchiveCanvas({
  items,
  views,
}: {
  items: ArchiveItem[];
  views?: readonly ViewItem[];
}) {
  const { view, isMorphing } = useArchiveView();

  useEffect(() => {
    document.documentElement.classList.add("page-archive");
    // rigState is module-level, so a second visit in the same session would
    // otherwise resume mid-morph or mid-pan.
    resetArchiveToOrbView();
    return () => document.documentElement.classList.remove("page-archive");
  }, []);

  return (
    <div className="archive_stage">
      <p className="sr-only" role="heading" aria-level={1}>
        Archive
      </p>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <ArchiveScene items={items} />
      </Canvas>
      <ViewSwitcher
        label="Archive view"
        views={archiveViewsFrom(views)}
        view={view}
        busy={isMorphing}
        onSelect={setArchiveView}
        locked
      />
    </div>
  );
}
