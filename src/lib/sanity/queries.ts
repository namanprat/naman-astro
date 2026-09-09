const IMAGE = /* groq */ `image { asset->{_id, url}, hotspot, crop }`;

export const WORK_QUERY = /* groq */ `*[_type == "workProject"] | order(order asc) {
  "slug": slug.current,
  order,
  title,
  description,
  ${IMAGE},
  alt,
  coverVideo { asset->{ url, mimeType, originalFilename } },
  coverImage { asset->{_id, url}, hotspot, crop },
  featured,
  span,
  col,
  services,
  panels[] {
    _type,
    title,
    body,
    ${IMAGE},
    alt,
    video { asset->{ url, mimeType, originalFilename } }
  }
}`;

export const ARCHIVE_QUERY = /* groq */ `*[_type == "archiveItem"] | order(order asc) {
  "id": slug.current,
  order,
  span,
  ${IMAGE},
  video { asset->{ url, mimeType, originalFilename } }
}`;

export const SITE_QUERY = /* groq */ `*[_id == "site"][0]{
  heroNote,
  manifesto,
  team,
  footerTagline,
  preloader,
  notFound,
  workViews[]{ id, label },
  archiveViews[]{ id, label }
}`;

export const ABOUT_QUERY = /* groq */ `*[_id == "about"][0]{
  lead,
  clients,
  services
}`;

export const FAQ_QUERY = /* groq */ `*[_id == "faq"][0]{
  statement,
  lead,
  items[]{ question, answer }
}`;

export const PROCESS_QUERY = /* groq */ `*[_id == "process"][0]{
  statement,
  cards[]{ title, description, model }
}`;

export const NAV_QUERY = /* groq */ `*[_id == "nav"][0]{
  availabilityLine,
  enabled
}`;
