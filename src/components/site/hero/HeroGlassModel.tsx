/**
 * The hero object: duforn-old's logo GLB (`duforn-old/logo-3d.js`, then
 * `newlogo.glb`) with its `Car chrome` material thrown away and drei's
 * `MeshTransmissionMaterial` in its place.
 *
 * No controls. duforn-old's damped drag is gone; what is left is the autorotate
 * and the Y spin driven off scroll position, and both turn the mesh rather than
 * the camera — the wordmark plane under the glass is placed in screen space
 * against a fixed camera, so orbiting one would drag the mark off the DOM lockup
 * it is standing in for.
 *
 * Framing is the other departure: the original ran a 15° camera at `z = 0.135`,
 * which leaves the wordmark plane and the shell inside ~0.035 world units of
 * depth. The mesh is normalised instead and the camera is ordinary.
 */
import { MeshTransmissionMaterial } from "@react-three/drei";
import { useHeroLogo } from "./HeroLogoShell";

type HeroGlassModelProps = {
  /** Live material props, already merged with the phone overrides. */
  material: Record<string, number | boolean>;
};

export default function HeroGlassModel({ material }: HeroGlassModelProps) {
  const { fitted } = useHeroLogo();
  if (!fitted) return null;

  return (
    <mesh geometry={fitted.geo}>
      {/* No `background`: the scene's own is the fluid sim's render target,
          which is exactly what this is here to refract. */}
      <MeshTransmissionMaterial {...material} />
    </mesh>
  );
}
