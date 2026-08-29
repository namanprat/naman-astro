import {
  createContext,
  useContext,
  useRef,
  type MutableRefObject,
} from "react";
import type * as THREE from "three";

export type FluidSimState = {
  dye: THREE.Texture | null;
  /** True while the visitor is painting or dye is still settling. */
  active: boolean;
  /** Dye magnitude cutoff — matches the fluid display pass. */
  threshold: number;
  /** Width of the cut, centred on the threshold. 0 is a hard edge. */
  edgeSoftness: number;
};

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type FluidSimStateRef = MutableRefObject<FluidSimState>;

const DEFAULT: FluidSimState = {
  dye: null,
  active: false,
  threshold: 1,
  edgeSoftness: 0,
};

const FluidSimStateContext = createContext<FluidSimStateRef | null>(null);

export function FluidSimStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = useRef<FluidSimState>({ ...DEFAULT });
  return (
    <FluidSimStateContext.Provider value={state}>
      {children}
    </FluidSimStateContext.Provider>
  );
}

export function useFluidSimStateRef(): FluidSimStateRef {
  const ctx = useContext(FluidSimStateContext);
  if (!ctx) {
    throw new Error(
      "useFluidSimStateRef must be used inside FluidSimStateProvider",
    );
  }
  return ctx;
}
