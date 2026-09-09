import type { Loader, LoaderContext } from "astro/loaders";
import { getSanityClient } from "./client";

type MappedEntry = { id: string; data: Record<string, unknown> };

async function fetchSanityDocs(query: string): Promise<unknown[] | null> {
  try {
    const result = await getSanityClient().fetch<unknown>(query);
    if (result == null) return [];
    return Array.isArray(result) ? result.filter(Boolean) : [result];
  } catch (error) {
    console.warn("[sanity] fetch failed; using local YAML", error);
    return null;
  }
}

/**
 * Prefer published Sanity documents. Empty or unreachable dataset falls
 * through to the YAML `file`/`glob` loader so the site still builds.
 */
export function sanityOrYaml(options: {
  query: string;
  fallback: Loader;
  map: (docs: unknown[]) => MappedEntry[];
}): Loader {
  return {
    name: `sanity-or-${options.fallback.name}`,
    load: async (ctx: LoaderContext) => {
      const docs = await fetchSanityDocs(options.query);
      if (!docs) {
        return options.fallback.load(ctx);
      }
      const entries = options.map(docs).filter((entry) => entry.id);
      if (!entries.length) {
        return options.fallback.load(ctx);
      }
      ctx.store.clear();
      for (const entry of entries) {
        const data = await ctx.parseData({ id: entry.id, data: entry.data });
        ctx.store.set({
          id: entry.id,
          data,
          digest: ctx.generateDigest(data),
        });
      }
    },
  };
}
