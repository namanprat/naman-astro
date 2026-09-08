/**
 * Every subject the site renders, as a queryable collection.
 *
 * ponytail: `src/consts.ts` stays where it is and out of these collections.
 * `astro.config.mjs` imports it at config-evaluation time, before any content
 * layer exists, so it cannot come from here. The line: `consts.ts` is the
 * site's identity and SEO (name, canonical origin, noindex routes),
 * collections are the copy a person would want to edit without touching code.
 *
 * ponytail: each collection is the local YAML wrapped in `sanityOrLocal`.
 * When `PUBLIC_SANITY_PROJECT_ID` is set and the dataset answers, the GROQ
 * query wins; otherwise the committed files load exactly as they did in
 * Phase B. That is what keeps this container, CI without secrets, and an
 * offline laptop building the same site.
 */
import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { sanityOrLocal } from "./lib/sanity/loader";
import { QUERIES } from "./lib/sanity/queries";
import {
  aboutSchema,
  archiveSchema,
  faqSchema,
  navSchema,
  processSchema,
  siteSchema,
  workSchema,
} from "./lib/content/schemas";

export { WORK_SERVICES } from "./lib/content/schemas";

const work = defineCollection({
  // ponytail: the entry id is the filename stem, which is also the /work/[slug]
  // route. `slug` is therefore absent from the front matter — carrying both
  // invites a file whose name and slug disagree. Sanity stores the same value
  // on `slug.current`; the loader maps it back to the entry id.
  loader: sanityOrLocal({
    type: "work",
    query: QUERIES.work,
    id: (doc) => String(doc.id),
    local: glob({ base: "./src/content/work", pattern: "**/*.yaml" }),
  }),
  schema: workSchema,
});

const faq = defineCollection({
  loader: sanityOrLocal({
    type: "faq",
    query: QUERIES.faq,
    id: () => "faq",
    local: file("src/content/faq.yaml"),
  }),
  schema: faqSchema,
});

const process = defineCollection({
  loader: sanityOrLocal({
    type: "process",
    query: QUERIES.process,
    id: () => "process",
    local: file("src/content/process.yaml"),
  }),
  schema: processSchema,
});

const about = defineCollection({
  loader: sanityOrLocal({
    type: "about",
    query: QUERIES.about,
    id: () => "about",
    local: file("src/content/about.yaml"),
  }),
  schema: aboutSchema,
});

const nav = defineCollection({
  loader: sanityOrLocal({
    type: "nav",
    query: QUERIES.nav,
    id: () => "nav",
    local: file("src/content/nav.yaml"),
  }),
  schema: navSchema,
});

const site = defineCollection({
  loader: sanityOrLocal({
    type: "site",
    query: QUERIES.site,
    id: () => "site",
    local: file("src/content/site.yaml"),
  }),
  schema: siteSchema,
});

const archive = defineCollection({
  loader: sanityOrLocal({
    type: "archive",
    query: QUERIES.archive,
    id: (doc) => String(doc.id),
    local: file("src/content/archive.yaml"),
  }),
  schema: archiveSchema,
});

export const collections = { work, faq, process, about, nav, site, archive };
