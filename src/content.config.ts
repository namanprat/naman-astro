/**
 * Every subject the site renders, as a queryable collection.
 *
 * Loaders prefer published Sanity documents and fall back to these YAML files
 * when the dataset is empty or unreachable. The shapes here are the shapes
 * Sanity hands back: an ordered `panels` array of typed blocks, not a Markdown
 * body, so `groupWorkPanels` can pair neighbours without a second schema.
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
import { WORK_SERVICES } from "./content/services";
import { sanityOrYaml } from "./lib/sanity/loader";
import {
  mapAbout,
  mapArchiveItem,
  mapFaq,
  mapNav,
  mapProcess,
  mapSite,
  mapWorkProject,
  type RawAbout,
  type RawArchiveItem,
  type RawFaq,
  type RawNav,
  type RawProcess,
  type RawSite,
  type RawWorkProject,
} from "./lib/sanity/map";
import {
  ABOUT_QUERY,
  ARCHIVE_QUERY,
  FAQ_QUERY,
  NAV_QUERY,
  PROCESS_QUERY,
  SITE_QUERY,
  WORK_QUERY,
} from "./lib/sanity/queries";

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
  // ponytail: the entry id is the filename stem / Sanity slug, which is also
  // the /work/[slug] route. `slug` is therefore absent from the front matter —
  // carrying both invites a file whose name and slug disagree.
  loader: sanityOrYaml({
    query: WORK_QUERY,
    fallback: glob({ base: "./src/content/work", pattern: "**/*.yaml" }),
    map: (docs) =>
      docs
        .map((doc) => mapWorkProject(doc as RawWorkProject))
        .filter((entry) => entry !== null),
  }),
  schema: z.object({
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
  }),
});

const faq = defineCollection({
  loader: sanityOrYaml({
    query: FAQ_QUERY,
    fallback: file("src/content/faq.yaml"),
    map: (docs) =>
      docs.map((doc) => mapFaq(doc as RawFaq)).filter((entry) => entry !== null),
  }),
  schema: z.object({
    statement: z.string(),
    lead: z.string(),
    items: z
      .array(z.object({ question: z.string(), answer: z.string() }))
      .nonempty(),
  }),
});

const process = defineCollection({
  loader: sanityOrYaml({
    query: PROCESS_QUERY,
    fallback: file("src/content/process.yaml"),
    map: (docs) =>
      docs
        .map((doc) => mapProcess(doc as RawProcess))
        .filter((entry) => entry !== null),
  }),
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
  loader: sanityOrYaml({
    query: ABOUT_QUERY,
    fallback: file("src/content/about.yaml"),
    map: (docs) =>
      docs
        .map((doc) => mapAbout(doc as RawAbout))
        .filter((entry) => entry !== null),
  }),
  schema: z.object({
    lead: z.string(),
    clients: z.array(z.string()).nonempty(),
    /** Filled from WORK_SERVICES; see the note on that const. */
    services: z.array(workService).default([...WORK_SERVICES]),
  }),
});

const nav = defineCollection({
  // ponytail: only the availability marquee. Stacks, socials, overlay, email,
  // and scroll-spy ids are site wiring in `src/lib/content/nav.ts`.
  loader: sanityOrYaml({
    query: NAV_QUERY,
    fallback: file("src/content/nav.yaml"),
    map: (docs) =>
      docs.map((doc) => mapNav(doc as RawNav)).filter((entry) => entry !== null),
  }),
  schema: z.object({
    availabilityLine: z.string(),
    availabilityCopies: z.number().int().positive(),
  }),
});

const viewItem = z.object({ id: z.string(), label: z.string() });

const site = defineCollection({
  loader: sanityOrYaml({
    query: SITE_QUERY,
    fallback: file("src/content/site.yaml"),
    map: (docs) =>
      docs
        .map((doc) => mapSite(doc as RawSite))
        .filter((entry) => entry !== null),
  }),
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
  loader: sanityOrYaml({
    query: ARCHIVE_QUERY,
    fallback: file("src/content/archive.yaml"),
    map: (docs) =>
      docs
        .map((doc) => mapArchiveItem(doc as RawArchiveItem))
        .filter((entry) => entry !== null),
  }),
  schema: z.object({
    /**
     * Listing order. YAML keys used to imply this; Sanity cannot, so both
     * sources now carry it and callers sort on it.
     */
    order: z.number().int().nonnegative().optional(),
    /**
     * Pre-encoded when local: several filenames contain spaces and the image
     * `src` uses these strings verbatim. Sanity CDN URLs are used as-is.
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
