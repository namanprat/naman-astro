/**
 * Archive poster media. Paths are pre-encoded: several filenames contain
 * spaces, and the image `src` uses these strings verbatim.
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

export const ARCHIVE_ITEMS: ArchiveItem[] = [
  { src: "/archive/brhm.webp" },
  { src: "/archive/Duforn%20Poster%201.webp" },
  { src: "/archive/Duforn%20Poster%202.webp" },
  { src: "/archive/first%20act.webp" },
  { src: "/archive/Frame%2012.webp" },
  { src: "/archive/IMG_4294.webm" },
  { src: "/archive/ipod.webp" },
  { src: "/archive/Poster%206.webp" },
  { src: "/archive/Poster9%20File.webp" },
  { src: "/archive/Unstoppable.webp" },
  { src: "/archive/Vector-1.webp", span: "width" },
];

export const ARCHIVE_MEDIA_URLS: string[] = ARCHIVE_ITEMS.map(
  (item) => item.src,
);
