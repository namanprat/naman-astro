import { Suspense } from "react";
import ArchiveCameras from "./ArchiveCameras";
import ArchiveGridScene from "./ArchiveGridScene";
import ArchivePosterField from "./ArchivePosterField";
import ArchiveSceneClear from "./ArchiveSceneClear";

/** Single archive scene — orb unwraps into infinite grid via rigState.morph. */
export default function ArchiveScene() {
  return (
    <>
      <ArchiveSceneClear />
      <ArchiveCameras />
      <ArchiveGridScene />
      <Suspense fallback={null}>
        <ArchivePosterField />
      </Suspense>
    </>
  );
}
