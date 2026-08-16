import { useEffect, useState } from "react";
import * as THREE from "three";
import { ARCHIVE_MEDIA_URLS } from "./archiveMedia";
import {
  configureArchiveTexture,
  disposeArchiveMediaSource,
  loadArchiveMediaSource,
  type ArchiveMediaSource,
} from "./archiveLoadMedia";

/** Per-mesh textures for the orb view. */
export function useArchiveTextures() {
  const [textures, setTextures] = useState<THREE.Texture[]>([]);

  useEffect(() => {
    if (!ARCHIVE_MEDIA_URLS.length) {
      setTextures([]);
      return undefined;
    }

    let cancelled = false;
    let loaded: ArchiveMediaSource[] = [];

    void Promise.all(ARCHIVE_MEDIA_URLS.map(loadArchiveMediaSource))
      .then((next) => {
        if (cancelled) {
          next.forEach(disposeArchiveMediaSource);
          return;
        }
        loaded = next;
        setTextures(next.map((s) => s.texture));
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error("[useArchiveTextures]", err);
      });

    return () => {
      cancelled = true;
      loaded.forEach(disposeArchiveMediaSource);
      setTextures([]);
    };
  }, []);

  return textures;
}

export { configureArchiveTexture, loadArchiveMediaSource, disposeArchiveMediaSource };
