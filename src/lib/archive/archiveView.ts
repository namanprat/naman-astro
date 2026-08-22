import { useSyncExternalStore } from "react";
import { requestArchiveMorph } from "./rigMorph";
import { rigState } from "./rigState";

export type ArchiveView = "orb" | "grid";

type Snapshot = { view: ArchiveView; isMorphing: boolean };

let snapshot: Snapshot = { view: "orb", isMorphing: false };
const listeners = new Set<() => void>();

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setArchiveView(view: ArchiveView): void {
  if (snapshot.isMorphing || snapshot.view === view) return;
  rigState.morphTarget = view === "grid" ? 1 : 0;
  emit({ view, isMorphing: true });
  requestArchiveMorph(() => emit({ view, isMorphing: false }));
}

/** Default orb view — call on archive enter / mount. */
export function resetArchiveToOrbView(): void {
  rigState.morph = 0;
  rigState.morphTarget = 0;
  rigState.isMorphing = false;
  rigState.gridPan.x = 0;
  rigState.gridPan.y = 0;
  rigState.gridPanTarget.x = 0;
  rigState.gridPanTarget.y = 0;
  rigState.isGridPanning = false;
  emit({ view: "orb", isMorphing: false });
}

export function useArchiveView(): Snapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
