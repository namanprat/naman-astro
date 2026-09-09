import { getCollection } from "astro:content";
import type { ArchiveItem } from "@/content/archive";

export async function getArchiveItems(): Promise<ArchiveItem[]> {
  const entries = await getCollection("archive");
  return entries
    .slice()
    .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0) || a.id.localeCompare(b.id))
    .map((entry) => ({
      src: entry.data.src,
      span: entry.data.span,
    }));
}
