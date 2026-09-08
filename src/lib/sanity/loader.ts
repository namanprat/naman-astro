/**
 * Content Layer loader: Sanity when the project is configured and reachable,
 * the committed YAML otherwise.
 *
 * ponytail: this is the whole reason Phase B landed first. A build in this
 * container, in CI without secrets, and on an offline laptop must produce the
 * same pages. The local files stay committed as the fallback, not as a
 * migration leftover.
 *
 * ponytail: `useCdn: false` so a build takes what the dataset has now, not
 * what the CDN last cached. Static output is the snapshot of that fetch.
 */
import { createClient } from "@sanity/client";
import type { Loader, LoaderContext } from "astro/loaders";
import { readSanityEnv, SANITY_API_VERSION } from "./env";

export type SanityDoc = Record<string, unknown>;

export type SanityOrLocalOptions = {
  type: string;
  query: string;
  local: Loader;
  /** Entry id. Work and archive read `slug.current` projected as `id`. */
  id: (doc: SanityDoc) => string;
  /** Optional reshape before the zod schema runs. */
  map?: (doc: SanityDoc) => SanityDoc;
};

function stripMeta(doc: SanityDoc): SanityDoc {
  const out: SanityDoc = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key.startsWith("_") || key === "id") continue;
    out[key] = value;
  }
  return out;
}

async function loadFromSanity(
  opts: SanityOrLocalOptions,
  ctx: LoaderContext,
): Promise<boolean> {
  const env = readSanityEnv();
  if (!env) return false;

  try {
    const client = createClient({
      projectId: env.projectId,
      dataset: env.dataset,
      apiVersion: SANITY_API_VERSION,
      useCdn: false,
      token: env.token,
    });
    const result: unknown = await client.fetch(opts.query);
    const docs = (Array.isArray(result) ? result : result ? [result] : [])
      .filter((doc): doc is SanityDoc => !!doc && typeof doc === "object");
    if (!docs.length) {
      ctx.logger.info(
        `sanity/${opts.type}: dataset empty, falling back to local files`,
      );
      return false;
    }

    const parsed: { id: string; data: SanityDoc; digest: string }[] = [];
    for (const doc of docs) {
      const id = opts.id(doc);
      if (!id) {
        throw new Error(`sanity/${opts.type}: document missing id`);
      }
      const raw = opts.map ? opts.map(doc) : stripMeta(doc);
      const data = await ctx.parseData({ id, data: raw });
      parsed.push({ id, data, digest: ctx.generateDigest(data) });
    }

    ctx.store.clear();
    for (const entry of parsed) ctx.store.set(entry);
    ctx.logger.info(`sanity/${opts.type}: ${parsed.length} document(s)`);
    return true;
  } catch (error) {
    ctx.logger.warn(
      `sanity/${opts.type}: ${error instanceof Error ? error.message : String(error)}; falling back to local files`,
    );
    ctx.store.clear();
    return false;
  }
}

export function sanityOrLocal(opts: SanityOrLocalOptions): Loader {
  return {
    name: `sanity-or-local:${opts.type}`,
    load: async (ctx) => {
      if (await loadFromSanity(opts, ctx)) return;
      await opts.local.load(ctx);
    },
  };
}
