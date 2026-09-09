import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import type { ArchiveItem } from "@/content/archive";
import { ARCHIVE_CONFIG } from "@/lib/archive/archiveConfig";
import {
  closeArchiveFocus,
  getArchiveFocusSnapshot,
  subscribeArchiveFocus,
  type ArchiveFocusSnapshot,
} from "@/lib/archive/archiveFocus";

const CLOSED: ArchiveFocusSnapshot = { index: -1, item: null };

/** Set on `<html>` while a poster is open, so the view switcher can stand down. */
const FOCUSED_CLASS = "archive-focused";

/**
 * The scrim and caption for an opened poster.
 *
 * The artwork itself is not here — it is the WebGL tile, which flies forward
 * inside the canvas (`PosterTile`). This is DOM rather than drei's `<Html>` so
 * the caption inherits the site's cascade and type scale like any other copy,
 * and it is a sibling of `<Canvas>` rather than a child of the scene.
 */
export default function ArchiveLightbox() {
  const snapshot = useSyncExternalStore(
    subscribeArchiveFocus,
    getArchiveFocusSnapshot,
    () => CLOSED,
  );
  const backdrop = useRef<HTMLButtonElement>(null);
  const open = snapshot.index >= 0;

  /* Held past the close so the caption fades with the tile instead of blanking
     on the first frame of the flight home. */
  const [shown, setShown] = useState<ArchiveItem | null>(null);
  useEffect(() => {
    if (snapshot.item) setShown(snapshot.item);
  }, [snapshot.item]);

  useEffect(() => {
    document.documentElement.classList.toggle(FOCUSED_CLASS, open);
    return () => document.documentElement.classList.remove(FOCUSED_CLASS);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    backdrop.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeArchiveFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The scrim fade is kept in step with the tile's flight rather than
  // restated as a magic number in CSS.
  const title = shown?.title?.trim();
  const description = shown?.description?.trim();

  return (
    <div
      className="archive_lightbox_wrap"
      data-open={open ? "" : undefined}
      style={
        {
          "--archive_lightbox_fade": `${ARCHIVE_CONFIG.focusDuration}s`,
        } as CSSProperties
      }
    >
      {/* Also what closes a click on the poster itself — it sits under the
          pointer, over the canvas, for the whole time the lightbox is open. */}
      <button
        ref={backdrop}
        type="button"
        className="archive_lightbox_backdrop"
        aria-label="Close artwork"
        onClick={closeArchiveFocus}
      />
      {(title || description) && (
        <div className="archive_lightbox_caption">
          {title && (
            <h5 className="archive_lightbox_title text-style-small">{title}</h5>
          )}
          {description && (
            <p className="archive_lightbox_body text-style-main">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
