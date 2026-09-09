/**
 * Archive poster media. Paths are pre-encoded when they come from `public/`:
 * several filenames contain spaces, and the image `src` uses those strings
 * verbatim. Sanity CDN URLs are used as-is.
 *
 * `span` picks which axis fills the standard tile. Default `"height"` (portrait
 * posters share a height). `"width"` is for landscape stickers so they don't
 * blow up to the poster height.
 */
export type ArchiveSpan = "height" | "width";

/**
 * `title` and `description` are the lightbox caption — the artwork is a WebGL
 * tile, so this is the only text the archive carries. Optional: an item with
 * neither still renders, it just opens without a caption.
 */
export type ArchiveItem = {
  src: string;
  span?: ArchiveSpan;
  title?: string;
  description?: string;
};

export function isArchiveVideo(src: string): boolean {
  return /\.webm(?:\?|$)/i.test(src);
}
