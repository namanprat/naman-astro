#!/usr/bin/env node
/**
 * Seed the Sanity dataset from the Phase B YAML, so the CMS starts with what
 * is already on the site rather than being retyped.
 *
 *   PUBLIC_SANITY_PROJECT_ID=… PUBLIC_SANITY_DATASET=… \
 *   SANITY_API_WRITE_TOKEN=… npm run sanity:migrate
 *
 * ponytail: dry-run is the default. Pass `--write` to mutate. This container
 * has no project and no token, so the default path is the one that can be
 * verified here: it parses every local file, builds the documents, and prints
 * the counts. The first real push is yours.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const WRITE = process.argv.includes("--write");
const ROOT = join(import.meta.dirname, "..");
const CONTENT = join(ROOT, "src/content");

const API_VERSION = "2025-02-19";

function readYaml(path) {
  return parse(readFileSync(path, "utf8"));
}

function keyed(items, prefix, type) {
  return items.map((item, i) => ({
    ...item,
    ...(type ? { _type: type } : {}),
    _key: `${prefix}-${i}`,
  }));
}

function workDocs() {
  const dir = join(CONTENT, "work");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => {
      const id = name.replace(/\.yaml$/, "");
      const data = readYaml(join(dir, name));
      return {
        _id: `work.${id}`,
        _type: "work",
        slug: { _type: "slug", current: id },
        ...data,
        panels: data.panels.map((panel, i) => ({
          ...panel,
          _type: panel.kind === "text" ? "workPanelText" : "workPanelImage",
          _key: `panel-${i}`,
        })),
        services: data.services,
      };
    });
}

function archiveDocs() {
  const data = readYaml(join(CONTENT, "archive.yaml"));
  return Object.entries(data).map(([id, item]) => ({
    _id: `archive.${id}`,
    _type: "archiveItem",
    slug: { _type: "slug", current: id },
    src: item.src,
    span: item.span ?? "height",
  }));
}

function singleton(name, extra = (data) => data) {
  const parsed = readYaml(join(CONTENT, `${name}.yaml`));
  const data = parsed[name] ?? parsed;
  return { _id: name, _type: name, ...extra(data) };
}

function overlayItem(item, i) {
  return item.action
    ? { _type: "navOverlayAction", _key: `action-${i}`, ...item }
    : { _type: "navOverlayLink", _key: `link-${i}`, ...item };
}

const documents = [
  ...workDocs(),
  ...archiveDocs(),
  singleton("faq", (data) => ({
    ...data,
    items: keyed(data.items, "faq", "faqItem"),
  })),
  singleton("process", (data) => ({
    ...data,
    cards: keyed(data.cards, "card", "processCard"),
  })),
  singleton("about"),
  singleton("nav", (data) => ({
    ...data,
    stacks: data.stacks.map((stack, i) => ({
      _type: "navStack",
      _key: `stack-${i}`,
      col: stack.col,
      links: keyed(stack.links, `stack-${i}`, "navStackLink"),
    })),
    socials: keyed(data.socials, "social", "navSocial"),
    overlayColumns: data.overlayColumns.map((col, i) =>
      col.map((item, j) => overlayItem(item, i * 10 + j)),
    ),
  })),
  singleton("site", (data) => ({
    ...data,
    team: { _type: "siteTeam", ...data.team },
    preloader: { _type: "sitePreloader", ...data.preloader },
    notFound: { _type: "siteNotFound", ...data.notFound },
    workViews: keyed(data.workViews, "work-view", "viewItem"),
    archiveViews: keyed(data.archiveViews, "archive-view", "viewItem"),
  })),
];

const counts = documents.reduce((map, doc) => {
  map[doc._type] = (map[doc._type] ?? 0) + 1;
  return map;
}, {});

console.log(
  `migrate-sanity: ${documents.length} documents` +
    (WRITE ? " (write)" : " (dry-run)"),
);
for (const [type, n] of Object.entries(counts).sort()) {
  console.log(`  ${String(n).padStart(3)}  ${type}`);
}

if (!WRITE) {
  console.log("re-run with --write and Sanity credentials to push.");
  process.exit(0);
}

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.PUBLIC_SANITY_DATASET?.trim() || "production";
const token = process.env.SANITY_API_WRITE_TOKEN?.trim();

if (!projectId || !token) {
  console.error(
    "Need PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN to write.",
  );
  process.exit(1);
}

const { createClient } = await import("@sanity/client");
const client = createClient({
  projectId,
  dataset,
  apiVersion: API_VERSION,
  useCdn: false,
  token,
});

const tx = client.transaction();
for (const doc of documents) tx.createOrReplace(doc);
const result = await tx.commit();
console.log(`wrote ${result.results.length} documents to ${projectId}/${dataset}`);
