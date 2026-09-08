/**
 * One GROQ query per collection, projecting the Phase B zod shape.
 *
 * ponytail: the projection *is* the schema. A `*[_type == "work"]` that then
 * got reshaped in the loader would be a second place the field list could
 * drift; these strings name the same keys `src/lib/content/schemas.ts` does,
 * and the unit check walks the projection names against the zod shape.
 */
const published = `&& !(_id in path("drafts.**"))`;

const workPanel = `{ kind, title, body, src, alt }`;

export const QUERIES = {
  work: `*[_type == "work" ${published}]{
    "id": slug.current,
    order, title, description, image, alt, coverVideo, coverImage, featured,
    span, col, services,
    panels[]${workPanel}
  }`,
  faq: `*[_type == "faq" ${published}][0]{
    statement, lead,
    items[]{ question, answer }
  }`,
  process: `*[_type == "process" ${published}][0]{
    statement,
    cards[]{ title, description, model }
  }`,
  about: `*[_type == "about" ${published}][0]{
    lead, clients, services
  }`,
  nav: `*[_type == "nav" ${published}][0]{
    availabilityLine, availabilityCopies, email,
    stacks[]{ col, links[]{ label, path, id } },
    socials[]{ label, href, newTab },
    overlayColumns,
    sectionIds
  }`,
  site: `*[_type == "site" ${published}][0]{
    heroNote, manifesto,
    team{ titleLines, body, ctaLabel, ctaHref },
    footerTagline,
    preloader{ locationLine, disciplineLine },
    notFound{ title, body, linkLabel },
    workViews[]{ id, label },
    archiveViews[]{ id, label }
  }`,
  archive: `*[_type == "archiveItem" ${published}]{
    "id": slug.current,
    src, span
  }`,
} as const;

export type QueryName = keyof typeof QUERIES;
