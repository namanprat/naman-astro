const IMAGE = /* groq */ `image { asset->{_id, url}, hotspot, crop }`;

export const WORK_QUERY = /* groq */ `*[_type == "workProject"] | order(order asc) {
  "slug": slug.current,
  order,
  title,
  description,
  ${IMAGE},
  alt,
  "coverVideo": coalesce(coverVideo.asset->url, coverVideo),
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

export const ARCHIVE_QUERY = /* groq */ `*[_type == "archiveItem"] | order(order asc) {
  "id": slug.current,
  order,
  span,
  ${IMAGE},
  "videoPath": coalesce(videoPath, video.asset->url)
}`;

export const SITE_QUERY = /* groq */ `*[_id == "site"][0]{
  "eyebrow": coalesce(eyebrow, heroNote),
  faq { statement, lead, items[]{ question, answer } },
  process { statement, cards[]{ title, description, model } }
}`;

export const ABOUT_QUERY = /* groq */ `*[_id == "about"][0]{
  lead,
  clients,
  services
}`;

export const FOOTER_QUERY = /* groq */ `*[_id == "footer"][0]{
  tagline,
  links[]{ label, path }
}`;

export const MARQUEE_QUERY = /* groq */ `*[_id == "marquee"][0]{
  copy,
  enabled
}`;
