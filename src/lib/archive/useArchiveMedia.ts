import { useEffect, useState } from "react";
import { ARCHIVE_MEDIA_URLS } from "@/content/archive";
import { isMobileLayout } from "@/lib/site/isMobileLayout";
import {
  disposeArchiveMediaSource,
  loadArchiveMediaSource,
  type ArchiveMediaSource,
} from "./archiveLoadMedia";

/**
 * Every archive source this device managed to decode, in manifest order.
 *
 * Settled rather than all-or-nothing: one asset the browser cannot handle —
 * the WebM clip on iOS — used to reject the whole batch and leave the poster
 * field with nothing to draw. The grid and the centre word do not depend on
 * the media, so the page still looked alive while every image was missing.
 * A source that fails is dropped and the rest mount.
 */
export function useArchiveMedia(): ArchiveMediaSource[] {
  const [sources, setSources] = useState<ArchiveMediaSource[]>([]);

  useEffect(() => {
    if (!ARCHIVE_MEDIA_URLS.length) {
      setSources([]);
      return undefined;
    }

    let cancelled = false;
    let loaded: ArchiveMediaSource[] = [];

    /*
     * No clip on the phone. It is 1.65MB — twice the whole resized poster set
     * (`scripts/archive-variants.mjs`) — and it feeds nine of a hundred tiles
     * picked at random. Every source has to settle before the field builds, so
     * that one file decided when the archive appeared. iOS has always gone
     * without it (`canPlayWebm` refuses the format), so this is the iPhone
     * archive on every phone rather than a new one.
     */
    const urls = isMobileLayout()
      ? ARCHIVE_MEDIA_URLS.filter((url) => !/\.webm$/i.test(url))
      : ARCHIVE_MEDIA_URLS;

    void Promise.allSettled(urls.map(loadArchiveMediaSource)).then((results) => {
      const next: ArchiveMediaSource[] = [];
      const skipped: string[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") next.push(result.value);
        else skipped.push(reasonText(result.reason));
      }
      // Not DEV-gated on purpose. A device-specific decode failure is exactly
      // the kind of thing that has to be visible on the device it happens on.
      if (skipped.length) {
        console.warn(`[archive] skipped ${skipped.length} media source(s):`, skipped.join(" | "));
      }
      if (cancelled) {
        next.forEach(disposeArchiveMediaSource);
        return;
      }
      loaded = next;
      setSources(next);
    });

    return () => {
      cancelled = true;
      loaded.forEach(disposeArchiveMediaSource);
      setSources([]);
    };
  }, []);

  return sources;
}

function reasonText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
