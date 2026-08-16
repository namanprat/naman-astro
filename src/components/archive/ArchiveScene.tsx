import { Suspense } from "react";
import ArchiveCameras from "./ArchiveCameras";
import ArchiveGridScene from "./ArchiveGridScene";
import ArchivePosterField from "./ArchivePosterField";
import ArchiveSceneClear from "./ArchiveSceneClear";
import ArchiveOrbReset from "./ArchiveOrbReset";

/** Single archive scene — orb unwraps into infinite grid via rigState.morph. */
export default function ArchiveScene() {
  return (
    <>
      <ArchiveOrbReset />
      <ArchiveSceneClear />
      <ArchiveCameras />
      <ArchiveGridScene />
      <Suspense fallback={null}>
        <ArchivePosterField />
      </Suspense>
    </>
  );
}
