import { create } from "zustand";
import { requestArchiveMorph } from "./rigMorph";
import { rigState } from "./rigState";

export type ArchiveView = "orb" | "grid";

interface ArchiveViewState {
  view: ArchiveView;
  isMorphing: boolean;
  setView: (view: ArchiveView) => void;
  setMorphing: (v: boolean) => void;
}

export const useArchiveViewStore = create<ArchiveViewState>((set, get) => ({
  view: "orb",
  isMorphing: false,
  setMorphing: (isMorphing) => set({ isMorphing }),
  setView: (view) => {
    if (get().isMorphing || get().view === view) return;
    rigState.morphTarget = view === "grid" ? 1 : 0;
    set({ view, isMorphing: true });
    requestArchiveMorph(() => set({ isMorphing: false }));
  },
}));

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
  useArchiveViewStore.setState({ view: "orb", isMorphing: false });
}
