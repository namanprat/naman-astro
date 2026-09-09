#!/usr/bin/env node
/**
 * Upload the YAML collections and public/ media into Sanity.
 *
 * Requires SANITY_API_WRITE_TOKEN. Without it this exits 0 so CI/local
 * builds that only read the dataset are not blocked.
 */
import { createReadStream, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@sanity/client";
import { parse } from "yaml";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.SANITY_API_WRITE_TOKEN;

if (!TOKEN) {
  console.log("seed-sanity: SANITY_API_WRITE_TOKEN unset; skipping.");
  process.exit(0);
}

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID ?? "dj9l9mvw",
  dataset: process.env.SANITY_DATASET ?? "production",
  apiVersion: "2026-09-08",
  token: TOKEN,
  useCdn: false,
});

const assetCache = new Map();

function publicPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "");
  return path.join(ROOT, "public", decoded.replace(/^\//, ""));
}

async function uploadFile(urlPath, kind) {
  if (!urlPath) return undefined;
  const cached = assetCache.get(urlPath);
  if (cached) return cached;
  const filePath = publicPath(urlPath);
  if (!existsSync(filePath)) {
    console.warn(`seed-sanity: missing ${filePath}`);
    return undefined;
  }
  const asset = await client.assets.upload(kind, createReadStream(filePath), {
    filename: path.basename(filePath),
  });
  const ref = { _type: "reference", _ref: asset._id };
  assetCache.set(urlPath, ref);
  return ref;
}

function imageField(asset) {
  return asset ? { _type: "image", asset } : undefined;
}

function fileField(asset) {
  return asset ? { _type: "file", asset } : undefined;
}

function loadYaml(rel) {
  return parse(readFileSync(path.join(ROOT, rel), "utf8"));
}

async function seedWork() {
  const dir = path.join(ROOT, "src/content/work");
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".yaml"))) {
    const slug = name.replace(/\.yaml$/, "");
    const data = loadYaml(`src/content/work/${name}`);
    const panels = [];
    for (const panel of data.panels ?? []) {
      if (panel.kind === "text") {
        panels.push({
          _type: "workPanelText",
          _key: `text-${panels.length}`,
          title: panel.title,
          body: panel.body,
        });
        continue;
      }
      const asset = await uploadFile(panel.src, "image");
      if (!asset) continue;
      panels.push({
        _type: "workPanelImage",
        _key: `image-${panels.length}`,
        image: imageField(asset),
        alt: panel.alt,
      });
    }
    await client.createOrReplace({
      _id: `work.${slug}`,
      _type: "workProject",
      title: data.title,
      slug: { _type: "slug", current: slug },
      order: data.order,
      description: data.description,
      image: imageField(await uploadFile(data.image, "image")),
      alt: data.alt,
      coverVideo: fileField(await uploadFile(data.coverVideo, "file")),
      coverImage: imageField(await uploadFile(data.coverImage, "image")),
      featured: Boolean(data.featured),
      span: data.span,
      col: data.col,
      services: data.services,
      panels,
    });
    console.log(`seed-sanity: work ${slug}`);
  }
}

async function seedArchive() {
  const entries = loadYaml("src/content/archive.yaml");
  for (const [id, data] of Object.entries(entries)) {
    const isVideo = /\.webm$/i.test(data.src);
    await client.createOrReplace({
      _id: `archive.${id}`,
      _type: "archiveItem",
      title: id,
      slug: { _type: "slug", current: id },
      order: data.order ?? 0,
      image: isVideo
        ? undefined
        : imageField(await uploadFile(data.src, "image")),
      video: isVideo ? fileField(await uploadFile(data.src, "file")) : undefined,
      span: data.span ?? "height",
    });
    console.log(`seed-sanity: archive ${id}`);
  }
}

async function seedSingletons() {
  const site = loadYaml("src/content/site.yaml").site;
  const about = loadYaml("src/content/about.yaml").about;
  const faq = loadYaml("src/content/faq.yaml").faq;
  const process = loadYaml("src/content/process.yaml").process;
  const nav = loadYaml("src/content/nav.yaml").nav;

  await client.createOrReplace({
    _id: "site",
    _type: "siteSettings",
    ...site,
  });
  await client.createOrReplace({
    _id: "about",
    _type: "aboutSettings",
    ...about,
  });
  await client.createOrReplace({
    _id: "faq",
    _type: "faqSettings",
    ...faq,
  });
  await client.createOrReplace({
    _id: "process",
    _type: "processSettings",
    ...process,
  });
  await client.createOrReplace({
    _id: "marquee",
    _type: "marqueeSettings",
    availabilityLine: nav.availabilityLine,
    enabled: Boolean(nav.enabled),
  });
  console.log("seed-sanity: singletons");
}

await seedWork();
await seedArchive();
await seedSingletons();
console.log("seed-sanity: done");
