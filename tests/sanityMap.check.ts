/**
 * Sanity documents map onto the collection shapes the site already renders.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import {
  mapArchiveItem,
  mapFaq,
  mapFooter,
  mapMarquee,
  mapSite,
  mapSocial,
  mapWorkProject,
  type RawWorkProject,
} from "../src/lib/sanity/map.ts";

const work = mapWorkProject({
  slug: "haptic",
  order: 1,
  title: "Haptic",
  description: "A tactile AI brand.",
  image: {
    asset: {
      _id: "image-abc-800x600-webp",
      url: "https://cdn.sanity.io/images/dj9l9mvw/production/abc-800x600.webp",
    },
  },
  alt: "Haptic",
  featured: true,
  services: ["Brand identity", "Motion design"],
  coverVideo: {
    asset: {
      url: "https://cdn.sanity.io/files/dj9l9mvw/production/reveal.webm",
    },
  },
  panels: [
    {
      _type: "workPanelImage",
      image: { asset: { _id: "image-hero-800x600-webp" } },
      alt: "Hero",
    },
    { _type: "workPanelText", title: "Why this", body: "Because." },
  ],
} satisfies RawWorkProject);

assert.ok(work, "valid work document must map");
assert.equal(work.id, "haptic");
assert.equal(work.data.title, "Haptic");
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
  mapWorkProject({
    slug: "haptic",
    order: 1,
    title: "Haptic",
    description: "A tactile AI brand.",
    image: {
      asset: {
        _id: "image-abc-800x600-webp",
        url: "https://cdn.sanity.io/images/dj9l9mvw/production/abc-800x600.webp",
      },
    },
    alt: "Haptic",
    services: ["Brand identity"],
    coverVideo: "/work/haptic/haptic-reveal.webm",
    panels: [{ _type: "workPanelText", title: "Why this", body: "Because." }],
  })?.data.coverVideo,
  "/work/haptic/haptic-reveal.webm",
  "string coverVideo paths survive mapping",
);

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

assert.equal(
  mapArchiveItem({
    id: "img-4294",
    order: 5,
    videoPath: "/archive/IMG_4294.webm",
  })?.data.src,
  "/archive/IMG_4294.webm",
  "string videoPath survives mapping",
);

const faq = mapFaq({
  statement: "Fewer projects.",
  lead: "What to know.",
  items: [{ question: "Who?", answer: "Us." }],
});
assert.ok(faq);
assert.equal(faq.items[0]?.question, "Who?");

const sitecopy = {
  manifesto: "We're a design practice.",
  team: {
    titleLines: ["We close", "that gap."],
    body: "Every impression counts.",
    ctaLabel: "View Work",
    ctaHref: "/work",
  },
  preloader: {
    locationLine: "Based in Mumbai",
    disciplineLine: "Brand, web, and motion",
  },
  notFound: {
    title: "This page doesn't exist",
    body: "It may have moved.",
    linkLabel: "Back to home",
  },
};

const site = mapSite({
  eyebrow: ["Brand, web, and motion", "for early-stage companies."],
  ...sitecopy,
  faq,
  process: {
    statement: "We build brands.",
    cards: [{ title: "Uncover", description: "Dig.", model: "1" }],
  },
});
assert.ok(site);
assert.equal(site.id, "site");
assert.equal((site.data.eyebrow as string[])[0], "Brand, web, and motion");
assert.equal(site.data.manifesto, "We're a design practice.");
assert.deepEqual(
  mapSite({
    heroNote: ["Brand, web, and motion"],
    ...sitecopy,
    faq,
    process: {
      statement: "We build brands.",
      cards: [{ title: "Uncover", description: "Dig.", model: "1" }],
    },
  })?.data.eyebrow,
  ["Brand, web, and motion"],
  "heroNote aliases eyebrow",
);
assert.equal(
  mapSite({ eyebrow: ["only"] }),
  null,
  "homepage without sitecopy/faq/process is dropped",
);

const footer = mapFooter({
  tagline: "A design practice.",
  links: [
    { label: "Home", path: "/" },
    { label: "Work", path: "/work" },
  ],
});
assert.ok(footer);
assert.equal(footer.data.tagline, "A design practice.");
assert.equal((footer.data.links as { label: string }[])[0]?.label, "Home");

const marquee = mapMarquee({
  copy: "available",
  enabled: false,
});
assert.ok(marquee);
assert.equal(marquee.data.copy, "available");
assert.equal(marquee.data.enabled, false);
assert.equal(
  mapMarquee({ enabled: true }),
  null,
  "incomplete marquee is dropped so YAML can take over",
);
assert.equal(
  mapMarquee({ copy: "from nav" })?.data.enabled,
  false,
  "nav fallback without enabled stays off",
);

const social = mapSocial({
  email: "a.namanprat@gmail.com",
  instagram: "https://www.instagram.com/namanprat_",
  discoveryCall: "https://cal.com/namanprat/discovery-call",
});
assert.ok(social);
assert.equal(social.data.emailHref, "mailto:a.namanprat@gmail.com");
const socialLinks = social.data.links as {
  label: string;
  href: string;
  newTab: boolean;
}[];
assert.equal(socialLinks[0]?.label, "Email");
assert.equal(socialLinks[0]?.newTab, false);
assert.equal(socialLinks[1]?.label, "Instagram");
assert.equal(socialLinks[1]?.newTab, true);
assert.equal(socialLinks[2]?.label, "Discovery Call");
assert.equal(
  mapSocial({
    email: "mailto:a.namanprat@gmail.com",
    instagram: "https://www.instagram.com/namanprat_",
    discoveryCall: "https://cal.com/namanprat/discovery-call",
  })?.data.emailHref,
  "mailto:a.namanprat@gmail.com",
  "mailto prefix is not doubled",
);
assert.equal(
  mapSocial({ email: "a.namanprat@gmail.com" }),
  null,
  "incomplete social is dropped so YAML can take over",
);

console.log("sanityMap: all assertions passed");
