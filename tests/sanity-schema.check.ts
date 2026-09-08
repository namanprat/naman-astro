/**
 * Sanity document fields and GROQ projections must name the same keys as the
 * Phase B zod schemas. Adding a field on one side and not the other is how
 * the CMS and the site silently disagree.
 */
import assert from "node:assert/strict";
import {
  collectionSchemas,
  type CollectionName,
} from "../src/lib/content/schemas.ts";
import { WORK_SERVICES } from "../src/lib/content/services.ts";
import { QUERIES } from "../src/lib/sanity/queries.ts";
import { schemaTypes } from "../sanity/schema.ts";
import { work } from "../sanity/schemas/work.ts";
import { about } from "../sanity/schemas/singletons.ts";

type StudioType = (typeof schemaTypes)[number];
type StudioField = { name: string; options?: { list?: unknown } };

function zodKeys(schema: { shape: Record<string, unknown> }): string[] {
  return Object.keys(schema.shape).sort();
}

function typeByName(name: string): StudioType {
  const found = schemaTypes.find((entry) => entry.name === name);
  assert.ok(found, `missing sanity type ${name}`);
  return found;
}

function fieldNames(type: StudioType): string[] {
  const fields = (type as StudioType & { fields?: StudioField[] }).fields ?? [];
  return fields.map((field) => field.name).sort();
}

function minus(list: string[], drop: string[]): string[] {
  return list.filter((name) => !drop.includes(name));
}

/** Top-level document type for each collection. `slug` is the entry id. */
const DOCUMENTS = {
  work: { type: "work", extra: ["slug"] },
  faq: { type: "faq", extra: [] },
  process: { type: "process", extra: [] },
  about: { type: "about", extra: [] },
  nav: { type: "nav", extra: [] },
  site: { type: "site", extra: [] },
  archive: { type: "archiveItem", extra: ["slug"] },
};

for (const [collection, { type, extra }] of Object.entries(DOCUMENTS)) {
  const fromZod = zodKeys(collectionSchemas[collection as CollectionName]);
  const fromStudio = minus(fieldNames(typeByName(type)), extra);
  assert.deepEqual(
    fromStudio,
    fromZod,
    `${collection}: studio fields ${fromStudio} !== zod ${fromZod}`,
  );
}

const NESTED: [string, string[]][] = [
  ["workPanelText", ["kind", "title", "body"]],
  ["workPanelImage", ["kind", "src", "alt"]],
  ["faqItem", ["question", "answer"]],
  ["processCard", ["title", "description", "model"]],
  ["navStackLink", ["label", "path", "id"]],
  ["navStack", ["col", "links"]],
  ["navSocial", ["label", "href", "newTab"]],
  ["navOverlayLink", ["label", "path"]],
  ["navOverlayAction", ["label", "action"]],
  ["viewItem", ["id", "label"]],
  ["siteTeam", ["titleLines", "body", "ctaLabel", "ctaHref"]],
  ["sitePreloader", ["locationLine", "disciplineLine"]],
  ["siteNotFound", ["title", "body", "linkLabel"]],
];

for (const [name, keys] of NESTED) {
  assert.deepEqual(
    fieldNames(typeByName(name)),
    [...keys].sort(),
    `${name} fields`,
  );
}

/** Every top-level zod key must appear in that collection's GROQ projection. */
for (const [collection, query] of Object.entries(QUERIES)) {
  for (const key of zodKeys(collectionSchemas[collection as CollectionName])) {
    assert.match(
      query,
      new RegExp(`\\b${key}\\b`),
      `${collection} GROQ missing zod key ${key}`,
    );
  }
}

const workServicesField = work.fields.find((field) => field.name === "services");
const aboutServicesField = about.fields.find((field) => field.name === "services");
assert.ok(workServicesField);
assert.ok(aboutServicesField);
assert.deepEqual(workServicesField.options?.list, [...WORK_SERVICES]);
assert.deepEqual(aboutServicesField.options?.list, [...WORK_SERVICES]);

console.log("sanity-schema: zod, studio and GROQ name the same fields.");
