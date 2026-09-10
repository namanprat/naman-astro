/**
 * Every read the site makes, against the current schema only.
 *
 * ponytail: no migration fallbacks. These queries used to coalesce onto retired
 * shapes — `heroNote` before it was `eyebrow`, standalone `faq` / `process` /
 * `nav` / `about` documents before they folded into the home page. Each one was
 * a branch that could quietly win, so an editor could change the real field and
 * see nothing move. `npm run sanity:reset` rewrites the dataset into these
 * shapes; anything older is deleted rather than read around.
 */
const IMAGE = /* groq */ `image { asset->{_id, url}, hotspot, crop }`;

export const WORK_QUERY = /* groq */ `*[_type == "workProject"] | order(order asc) {
  "slug": slug.current,
  order,
  title,
  description,
  website,
  ${IMAGE},
  alt,
  coverVideo,
  coverImage { asset->{_id, url}, hotspot, crop },
  featured,
  services,
  panels[] {
    _type,
    title,
    body,
    ${IMAGE},
    alt
  }
}`;

/** `videoPath` is a public path or CDN URL; `video` is an uploaded file. */
export const ARCHIVE_QUERY = /* groq */ `*[_type == "archiveItem"] | order(order asc) {
  "id": slug.current,
  order,
  span,
  ${IMAGE},
  "videoPath": coalesce(videoPath, video.asset->url)
}`;

/**
 * The home page, plus the two globals that live on `siteSettings`. They stay in
 * this one collection because `mapSite` and every consumer already read them
 * there — the split is editorial, so it belongs in the desk, not in the shapes.
 */
export const SITE_QUERY = /* groq */ `*[_id == "site"][0]{
  eyebrow,
  manifesto,
  team { titleLines, body, ctaLabel, ctaHref },
  process { statement, cards[]{ title, description, model } },
  faq { statement, lead, items[]{ question, answer } },
  "preloader": *[_id == "siteSettings"][0].preloader{ locationLine, disciplineLine },
  "notFound": *[_id == "siteSettings"][0].notFound{ title, body, linkLabel }
}`;

/** A section of the home page document; its own collection for the consumers. */
export const ABOUT_QUERY = /* groq */ `*[_id == "site"][0].about{ lead, clients, services }`;

export const FOOTER_QUERY = /* groq */ `*[_id == "footer"][0]{
  tagline,
  links[]{ label, path }
}`;

export const MARQUEE_QUERY = /* groq */ `*[_id == "marquee"][0]{ copy, enabled }`;

export const SOCIAL_QUERY = /* groq */ `*[_id == "social"][0]{ email, instagram, discoveryCall }`;
