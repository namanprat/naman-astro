import { PerspectiveCamera } from "@react-three/drei";
import { ARCHIVE_FOV } from "../../lib/archive/archiveConfig";

/**
 * duforn mirrored a shared room camera here so its ink transition could punch
 * the fov mid-route. There is no shared camera in this site — the archive owns
 * its canvas outright — so the camera just rests at ARCHIVE_FOV.
 */
export default function ArchiveCameras() {
  return (
    <PerspectiveCamera
      makeDefault
      position={[0, 0, 10]}
      fov={ARCHIVE_FOV}
      near={0.1}
      far={1000}
    />
  );
}
