import { useEffect, useState } from "react";
import { ARCHIVE_ITEMS } from "../../content/archive";
import {
  disposeArchiveMediaSource,
  loadArchiveMediaSource,
  type ArchiveMediaSource,
} from "./archiveLoadMedia";

/**
 * Per-mesh media for the orb view.
 *
 * `allSettled`, not `all`: the field is all-or-nothing off this array, so one
 * unplayable asset used to mean a hundred empty tiles — a black grid with the
 * centre label and nothing else. Survivors are enough to fill the orb.
 */
export function useArchiveMedia() {
  const [sources, setSources] = useState<ArchiveMediaSource[]>([]);

  useEffect(() => {
    if (!ARCHIVE_ITEMS.length) {
      setSources([]);
      return undefined;
    }

    let cancelled = false;
    let loaded: ArchiveMediaSource[] = [];

    void Promise.allSettled(ARCHIVE_ITEMS.map(loadArchiveMediaSource)).then(
      (results) => {
        const next = results.flatMap((result) => {
          if (result.status === "fulfilled") return [result.value];
          if (import.meta.env.DEV) {
            console.error("[useArchiveMedia]", result.reason);
          }
          return [];
        });

        if (cancelled) {
          next.forEach(disposeArchiveMediaSource);
          return;
        }
        loaded = next;
        setSources(next);
      },
    );

    return () => {
      cancelled = true;
      loaded.forEach(disposeArchiveMediaSource);
      setSources([]);
    };
  }, []);

  return sources;
}
