/**
 * Sanity documents map onto the collection shapes the site already renders.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import {
  mapArchiveItem,
  mapFaq,
  mapNav,
  mapWorkProject,
  type RawWorkProject,
} from "../src/lib/sanity/map.ts";

const work = mapWorkProject({
  slug: "haptic",
  order: 1,
  title: "Haptic",
  description: "A tactile AI brand.",
  image: { asset: { _id: "image-abc-800x600-webp", url: "https://cdn.sanity.io/images/dj9l9mvw/production/abc-800x600.webp" } },
  alt: "Haptic",
  featured: true,
  span: 3,
  col: 7,
  services: ["Brand identity", "Motion design"],
  coverVideo: { asset: { url: "https://cdn.sanity.io/files/dj9l9mvw/production/reveal.webm" } },
  panels: [
    { _type: "workPanelImage", image: { asset: { _id: "image-hero-800x600-webp" } }, alt: "Hero" },
    { _type: "workPanelText", title: "Why this", body: "Because." },
  ],
} satisfies RawWorkProject);

assert.ok(work, "valid work document must map");
assert.equal(work.id, "haptic");
assert.equal(work.data.title, "Haptic");
assert.equal(work.data.span, 3);
assert.equal(work.data.featured, true);
assert.match(String(work.data.image), /cdn\.sanity\.io/);
assert.equal(
  work.data.coverVideo,
  "https://cdn.sanity.io/files/dj9l9mvw/production/reveal.webm",
);
assert.deepEqual(work.data.services, ["Brand identity", "Motion design"]);
const panels = work.data.panels as { kind: string }[];
assert.equal(panels[0]?.kind, "image");
assert.equal(panels[1]?.kind, "text");

assert.equal(
  mapWorkProject({ slug: "x", title: "Nope" }),
  null,
  "incomplete work is dropped so YAML can take over",
);

const archive = mapArchiveItem({
  id: "vector-1",
  order: 10,
  span: "width",
  image: { asset: { _id: "image-sticker-400x200-webp" } },
});
assert.ok(archive);
assert.equal(archive.id, "vector-1");
assert.equal(archive.data.span, "width");
assert.match(String(archive.data.src), /cdn\.sanity\.io/);

const faq = mapFaq({
  statement: "Fewer projects.",
  lead: "What to know.",
  items: [{ question: "Who?", answer: "Us." }],
});
assert.ok(faq);
assert.equal(faq.id, "faq");
assert.equal((faq.data.items as { question: string }[])[0]?.question, "Who?");

const nav = mapNav({
  availabilityLine: "available",
  availabilityCopies: 6,
  email: "mailto:a.namanprat@gmail.com",
  stacks: [
    {
      col: "is-home",
      links: [{ label: "Home", path: "/", id: "hero" }],
    },
  ],
  socials: [{ label: "Email", href: "mailto:a.namanprat@gmail.com" }],
  overlayColumns: [
    { items: [{ label: "Work", path: "/work" }, { label: "Theme", action: "theme" }] },
  ],
  sectionIds: ["hero", "team"],
});
assert.ok(nav);
assert.equal((nav.data.overlayColumns as unknown[][])[0]?.length, 2);
assert.deepEqual((nav.data.overlayColumns as { action?: string }[][])[0]?.[1], {
  label: "Theme",
  action: "theme",
});

console.log("sanityMap: all assertions passed");
