/**
 * The shapes every collection is validated against.
 *
 * ponytail: one module, two readers. `content.config.ts` uses these as the
 * Astro collection schemas; `sanity/schemas/` restates them as Studio fields.
 * The unit check in `tests/sanity-schema.check.ts` walks both and fails if a
 * field exists on one side and not the other — that is what "the two can't
 * drift" actually is, rather than a comment asking a person to remember.
 *
 * ponytail: the shapes are deliberately the shapes Sanity will hand back, not
 * the shapes that were easiest to lift out of the components. The case-study
 * `panels` array is the clearest case — it could have been a Markdown body,
 * which reads better in a text editor, but a CMS returns an ordered array of
 * typed blocks and `groupWorkPanels` pairs adjacent text and image blocks to
 * build the grid. Keeping the array means swapping the loader in the Sanity
 * phase touches no component and no schema.
 */
import { z } from "astro/zod";
import { WORK_SERVICES } from "./services.ts";

export { WORK_SERVICES } from "./services.ts";

export const workService = z.enum(WORK_SERVICES);

/** One block of a case study. Ordered; `groupWorkPanels` pairs neighbours. */
export const workPanel = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    title: z.string(),
    body: z.string(),
  }),
  z.object({
    kind: z.literal("image"),
    src: z.string(),
    alt: z.string(),
  }),
]);

export const workSchema = z.object({
  /**
   * Where the project sits in every listing — the gallery grid, the featured
   * slider, the /work order.
   *
   * ponytail: explicit, because the collection cannot infer it. This content
   * was an ordered array in `content/work.ts` and the order was load-bearing;
   * `glob()` returns entries in filesystem order, which is alphabetical, so
   * without this every project silently reshuffles the moment it is read from
   * the collection instead of the array. Callers sort on it rather than
   * trusting `getCollection`'s order.
   */
  order: z.number().int().nonnegative(),
  title: z.string(),
  description: z.string(),
  image: z.string(),
  alt: z.string(),
  /** Motion piece stacked under the cover on the case-study page. */
  coverVideo: z.string().optional(),
  /** Still stacked under the cover — same slot as `coverVideo`. */
  coverImage: z.string().optional(),
  /** Shown in the home featured slider. */
  featured: z.boolean().default(false),
  /**
   * ponytail: `span` and `col` are Lumos grid coordinates, so layout data in
   * a content schema. They stay because they are per-project editorial
   * decisions — which project gets the wide tile, and where the row breaks —
   * not a rule a layout table could derive. `col` is 0-indexed and clamped
   * at render so `col + span` fits the column count at the breakpoint.
   */
  span: z.union([z.literal(2), z.literal(3), z.literal(5)]),
  col: z.number().int().nonnegative(),
  services: z.array(workService).nonempty(),
  panels: z.array(workPanel).nonempty(),
});

export const faqSchema = z.object({
  statement: z.string(),
  lead: z.string(),
  items: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .nonempty(),
});

export const processSchema = z.object({
  statement: z.string(),
  cards: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        /** Matches the GLB under public/models and the tuning entry id. */
        model: z.enum(["1", "2", "3"]),
      }),
    )
    .nonempty(),
});

export const aboutSchema = z.object({
  lead: z.string(),
  clients: z.array(z.string()).nonempty(),
  /** Filled from WORK_SERVICES; see the note on that const. */
  services: z.array(workService).default([...WORK_SERVICES]),
});

export const overlayItem = z.union([
  z.object({ label: z.string(), path: z.string() }),
  z.object({ label: z.string(), action: z.literal("theme") }),
]);

export const navSchema = z.object({
  availabilityLine: z.string(),
  availabilityCopies: z.number().int().positive(),
  email: z.string(),
  stacks: z
    .array(
      z.object({
        col: z.string(),
        links: z
          .array(
            z.object({
              label: z.string(),
              path: z.string(),
              id: z.string(),
            }),
          )
          .nonempty(),
      }),
    )
    .nonempty(),
  socials: z
    .array(
      z.object({
        label: z.string(),
        href: z.string(),
        /** Opens in a new tab (Instagram, booking links). */
        newTab: z.boolean().default(false),
      }),
    )
    .nonempty(),
  overlayColumns: z.array(z.array(overlayItem).nonempty()).nonempty(),
  sectionIds: z.array(z.string()).nonempty(),
});

export const viewItem = z.object({ id: z.string(), label: z.string() });

export const siteSchema = z.object({
  heroNote: z.array(z.string()).nonempty(),
  manifesto: z.string(),
  team: z.object({
    titleLines: z.array(z.string()).nonempty(),
    body: z.string(),
    ctaLabel: z.string(),
    ctaHref: z.string(),
  }),
  footerTagline: z.string(),
  preloader: z.object({
    locationLine: z.string(),
    disciplineLine: z.string(),
  }),
  notFound: z.object({
    title: z.string(),
    body: z.string(),
    linkLabel: z.string(),
  }),
  workViews: z.array(viewItem).nonempty(),
  archiveViews: z.array(viewItem).nonempty(),
});

export const archiveSchema = z.object({
  /**
   * Pre-encoded: several filenames contain spaces and the image `src` uses
   * these strings verbatim.
   */
  src: z.string(),
  /**
   * Which axis fills the standard tile. Portrait posters share a height;
   * `width` is for landscape stickers so they don't blow up to poster height.
   */
  span: z.enum(["height", "width"]).default("height"),
});

/** Collection name → the zod schema the loader validates against. */
export const collectionSchemas = {
  work: workSchema,
  faq: faqSchema,
  process: processSchema,
  about: aboutSchema,
  nav: navSchema,
  site: siteSchema,
  archive: archiveSchema,
} as const;

export type CollectionName = keyof typeof collectionSchemas;
