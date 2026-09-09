/**
 * Reading the work collection, in the order the site presents it.
 *
 * ponytail: a module rather than each caller writing `getCollection("work")`,
 * because `getCollection` returns glob entries in filesystem order and every
 * caller wants them in `order` instead. Left to itself each one would either
 * remember to sort or quietly render the projects alphabetically — and the
 * gallery, the featured slider and /work would then disagree with each other.
 */
import { getCollection, type CollectionEntry } from "astro:content";
import type { WorkItem } from "@/content/work";

export type WorkEntry = CollectionEntry<"work">;

/** The `/work/[slug]` route for an entry. The id is the slug. */
export const workHref = (entry: WorkEntry) => `/work/${entry.id}`;

export async function getWorkItems(): Promise<WorkEntry[]> {
  const entries = await getCollection("work");
  return entries.sort((a, b) => a.data.order - b.data.order);
}

export async function getFeaturedWorkItems(): Promise<WorkEntry[]> {
  return (await getWorkItems()).filter((entry) => entry.data.featured);
}

export function toWorkItem(entry: WorkEntry): WorkItem {
  return {
    slug: entry.id,
    title: entry.data.title,
    description: entry.data.description,
    website: entry.data.website,
    image: entry.data.image,
    alt: entry.data.alt,
    coverVideo: entry.data.coverVideo,
    coverImage: entry.data.coverImage,
    featured: entry.data.featured,
    services: [...entry.data.services],
    panels: entry.data.panels,
  };
}
