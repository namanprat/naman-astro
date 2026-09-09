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

function loadYaml(rel) {
  return parse(readFileSync(path.join(ROOT, rel), "utf8"));
}

function keyed(items, prefix) {
  return items.map((item, index) => ({ ...item, _key: `${prefix}-${index}` }));
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
      website: data.website,
      image: imageField(await uploadFile(data.image, "image")),
      alt: data.alt,
      coverVideo: data.coverVideo,
      coverImage: imageField(await uploadFile(data.coverImage, "image")),
      featured: Boolean(data.featured),
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
      videoPath: isVideo ? data.src : undefined,
      span: data.span ?? "height",
    });
    console.log(`seed-sanity: archive ${id}`);
  }
}

async function seedSingletons() {
  const site = loadYaml("src/content/site.yaml").site;
  const about = loadYaml("src/content/about.yaml").about;
  const footer = loadYaml("src/content/footer.yaml").footer;
  const marquee = loadYaml("src/content/marquee.yaml").marquee;
  const social = loadYaml("src/content/social.yaml").social;

  await client.createOrReplace({
    _id: "site",
    _type: "site",
    eyebrow: site.eyebrow,
    manifesto: site.manifesto,
    team: site.team,
    preloader: site.preloader,
    notFound: site.notFound,
    faq: {
      statement: site.faq.statement,
      lead: site.faq.lead,
      items: keyed(site.faq.items, "faq"),
    },
    process: {
      statement: site.process.statement,
      cards: keyed(site.process.cards, "process"),
    },
  });
  await client.createOrReplace({
    _id: "about",
    _type: "about",
    ...about,
  });
  await client.createOrReplace({
    _id: "footer",
    _type: "footer",
    tagline: footer.tagline,
    links: keyed(footer.links, "link"),
  });
  await client.createOrReplace({
    _id: "marquee",
    _type: "marquee",
    copy: marquee.copy,
    enabled: Boolean(marquee.enabled),
  });
  await client.createOrReplace({
    _id: "social",
    _type: "social",
    email: social.emailHref.replace(/^mailto:/i, ""),
    instagram: social.links.find((link) => link.label === "Instagram")?.href,
    discoveryCall: social.links.find((link) => link.label === "Discovery Call")
      ?.href,
  });
  console.log("seed-sanity: singletons");
}

await seedWork();
await seedArchive();
await seedSingletons();
console.log("seed-sanity: done");
