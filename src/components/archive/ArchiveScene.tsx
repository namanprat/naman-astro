import { Suspense } from "react";
import type { ArchiveItem } from "@/content/archive";
import ArchiveCameras from "./ArchiveCameras";
import ArchiveGridScene from "./ArchiveGridScene";
import ArchivePosterField from "./ArchivePosterField";
import ArchiveSceneClear from "./ArchiveSceneClear";

/** Single archive scene — orb unwraps into infinite grid via rigState.morph. */
export default function ArchiveScene({ items }: { items: ArchiveItem[] }) {
  return (
    <>
      <ArchiveSceneClear />
      <ArchiveCameras />
      <ArchiveGridScene />
      <Suspense fallback={null}>
        <ArchivePosterField items={items} />
      </Suspense>
    </>
  );
}
