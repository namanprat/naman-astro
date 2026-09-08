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

export type ArchiveItem = {
  src: string;
  span?: ArchiveSpan;
};

export function isArchiveVideo(src: string): boolean {
  return /\.webm(?:\?|$)/i.test(src);
}
