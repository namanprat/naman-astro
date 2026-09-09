import {
  createImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";
import { SANITY_DATASET, SANITY_PROJECT_ID } from "./config.ts";

const builder = createImageUrlBuilder({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
});

export type SanityImage = {
  asset?: { _id?: string; _ref?: string; url?: string };
  hotspot?: unknown;
  crop?: unknown;
} | null;

function asSource(image: SanityImage | undefined): SanityImageSource | null {
  if (!image?.asset) return null;
  const ref = image.asset._ref ?? image.asset._id;
  if (!ref) return image.asset.url ? (image as SanityImageSource) : null;
  return {
    asset: { _ref: ref },
    hotspot: image.hotspot,
    crop: image.crop,
  } as SanityImageSource;
}

/** CDN URL. `width` is a longest-edge cap; omit it for the master. */
export function imageUrl(
  image: SanityImage | undefined,
  width?: number,
): string {
  const source = asSource(image);
  if (!source) {
    return image?.asset?.url ?? "";
  }
  let next = builder.image(source).auto("format");
  if (width) next = next.width(width).fit("max");
  return next.url() || image?.asset?.url || "";
}
