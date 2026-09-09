/**
 * Every subject the site renders, as a queryable collection.
 *
 * Loaders prefer published Sanity documents and fall back to these YAML files
 * when the dataset is empty or unreachable. The shapes here are the shapes
 * Sanity hands back: an ordered `panels` array of typed blocks, not a Markdown
 * body, so `groupWorkPanels` can pair neighbours without a second schema.
 *
 * ponytail: `src/consts.ts` stays out of these collections. `astro.config.mjs`
 * imports consts at config-evaluation time, before any content layer exists.
 * View-switcher labels live next to the controllers that own the view ids.
 * Collections are the editorial surface: work, archive, homepage (Sitecopy /
 * FAQ / process), footer, about, marquee, social.
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
  mapFooter,
  mapMarquee,
  mapSite,
  mapSocial,
  mapWorkProject,
  type RawAbout,
  type RawArchiveItem,
  type RawFooter,
  type RawMarquee,
  type RawSite,
  type RawSocial,
  type RawWorkProject,
} from "./lib/sanity/map";
import {
  ABOUT_QUERY,
  ARCHIVE_QUERY,
  FOOTER_QUERY,
  MARQUEE_QUERY,
  SITE_QUERY,
  SOCIAL_QUERY,
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
     * Where the project sits in every listing — the gallery, the featured
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
    /** Live site. Shown as “Open website” under the case-study description. */
    website: z.string().optional(),
    image: z.string(),
    alt: z.string(),
    /** Motion piece stacked under the cover on the case-study page. */
    coverVideo: z.string().optional(),
    /** Still stacked under the cover — same slot as `coverVideo`. */
    coverImage: z.string().optional(),
    /** Shown in the home featured slider. */
    featured: z.boolean().default(false),
    services: z.array(workService).nonempty(),
    panels: z.array(workPanel).nonempty(),
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
    // ponytail: lines, not one string with a <br /> in it. The break is an
    // editorial decision so it belongs in the content, but as markup it would
    // force set:html at every render site and put raw HTML in a CMS field.
    eyebrow: z.array(z.string()).nonempty(),
    manifesto: z.string(),
    team: z.object({
      titleLines: z.array(z.string()).nonempty(),
      body: z.string(),
      ctaLabel: z.string(),
      ctaHref: z.string(),
    }),
    preloader: z.object({
      locationLine: z.string(),
      disciplineLine: z.string(),
    }),
    notFound: z.object({
      title: z.string(),
      body: z.string(),
      linkLabel: z.string(),
    }),
    faq: z.object({
      statement: z.string(),
      lead: z.string(),
      items: z
        .array(z.object({ question: z.string(), answer: z.string() }))
        .nonempty(),
    }),
    process: z.object({
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
  }),
});

const footer = defineCollection({
  // ponytail: footer labels can diverge from the header stacks; those stay
  // wiring in `src/lib/content/nav.ts`. Contact is omitted — the footer is
  // the contact section. Socials come from the `social` collection.
  loader: sanityOrYaml({
    query: FOOTER_QUERY,
    fallback: file("src/content/footer.yaml"),
    map: (docs) =>
      docs
        .map((doc) => mapFooter(doc as RawFooter))
        .filter((entry) => entry !== null),
  }),
  schema: z.object({
    tagline: z.string(),
    links: z
      .array(z.object({ label: z.string(), path: z.string() }))
      .nonempty(),
  }),
});

const marquee = defineCollection({
  // ponytail: only copy and on/off. Repeat count is layout in Menu.
  loader: sanityOrYaml({
    query: MARQUEE_QUERY,
    fallback: file("src/content/marquee.yaml"),
    map: (docs) =>
      docs
        .map((doc) => mapMarquee(doc as RawMarquee))
        .filter((entry) => entry !== null),
  }),
  schema: z.object({
    copy: z.string(),
    enabled: z.boolean().default(false),
  }),
});

const social = defineCollection({
  loader: sanityOrYaml({
    query: SOCIAL_QUERY,
    fallback: file("src/content/social.yaml"),
    map: (docs) =>
      docs
        .map((doc) => mapSocial(doc as RawSocial))
        .filter((entry) => entry !== null),
  }),
  schema: z.object({
    emailHref: z.string(),
    links: z
      .array(
        z.object({
          label: z.string(),
          href: z.string(),
          newTab: z.boolean(),
        }),
      )
      .nonempty(),
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
    /**
     * Lightbox caption. The artwork is a WebGL tile, so these two are the only
     * text the archive carries. Optional — an item without them opens bare.
     */
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const collections = {
  work,
  about,
  site,
  footer,
  marquee,
  social,
  archive,
};
