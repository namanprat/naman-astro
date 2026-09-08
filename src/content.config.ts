/**
 * Every subject the site renders, as a queryable collection.
 *
 * ponytail: the shapes here are deliberately the shapes Sanity will hand back
 * later, not the shapes that were easiest to lift out of the components. The
 * case-study `panels` array is the clearest case — it could have been a
 * Markdown body, which reads better in a text editor, but a CMS returns an
 * ordered array of typed blocks and `groupWorkPanels` pairs adjacent text and
 * image blocks to build the grid. Keeping the array means swapping the loader
 * in the Sanity phase touches no component and no schema.
 *
 * ponytail: `src/consts.ts` stays where it is and out of these collections.
 * `astro.config.mjs` imports it at config-evaluation time, before any content
 * layer exists, so it cannot come from here. The line: `consts.ts` is the
 * site's identity and SEO (name, canonical origin, noindex routes),
 * collections are the copy a person would want to edit without touching code.
 */
import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
// ponytail: `astro/zod`, not the `z` that `astro:content` still re-exports —
// that re-export is deprecated in Astro 7 and every schema line using it draws
// a ts(6385). Same zod, one import away from 97 warnings.
import { z } from "astro/zod";

/**
 * What the studio sells, tagged per project and listed on the About panel.
 *
 * ponytail: one definition, two readers. `AboutContent.tsx` used to carry its
 * own `SERVICES` const alongside this union, which meant adding a service was
 * two edits and forgetting the second was silent. The About collection now
 * derives its list from this, so the two cannot disagree.
 */
export const WORK_SERVICES = [
  "Brand identity",
  "Website design",
  "Website development",
  "Motion design",
  "3D",
] as const;

const workService = z.enum(WORK_SERVICES);

/** One block of a case study. Ordered; `groupWorkPanels` pairs neighbours. */
const workPanel = z.discriminatedUnion("kind", [
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

const work = defineCollection({
  // ponytail: the entry id is the filename stem, which is also the /work/[slug]
  // route. `slug` is therefore absent from the front matter — carrying both
  // invites a file whose name and slug disagree.
  loader: glob({ base: "./src/content/work", pattern: "**/*.yaml" }),
  schema: z.object({
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
  }),
});

const faq = defineCollection({
  loader: file("src/content/faq.yaml"),
  schema: z.object({
    statement: z.string(),
    lead: z.string(),
    items: z
      .array(z.object({ question: z.string(), answer: z.string() }))
      .nonempty(),
  }),
});

const process = defineCollection({
  loader: file("src/content/process.yaml"),
  schema: z.object({
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
  }),
});

const about = defineCollection({
  loader: file("src/content/about.yaml"),
  schema: z.object({
    lead: z.string(),
    clients: z.array(z.string()).nonempty(),
    /** Filled from WORK_SERVICES; see the note on that const. */
    services: z.array(workService).default([...WORK_SERVICES]),
  }),
});

const overlayItem = z.union([
  z.object({ label: z.string(), path: z.string() }),
  z.object({ label: z.string(), action: z.literal("theme") }),
]);

const nav = defineCollection({
  loader: file("src/content/nav.yaml"),
  schema: z.object({
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
  }),
});

const viewItem = z.object({ id: z.string(), label: z.string() });

const site = defineCollection({
  loader: file("src/content/site.yaml"),
  schema: z.object({
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
  }),
});

const archive = defineCollection({
  loader: file("src/content/archive.yaml"),
  schema: z.object({
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
  }),
});

export const collections = { work, faq, process, about, nav, site, archive };
