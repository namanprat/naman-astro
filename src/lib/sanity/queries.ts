const IMAGE = /* groq */ `image { asset->{_id, url}, hotspot, crop }`;

const FAQ = /* groq */ `{ statement, lead, items[]{ question, answer } }`;
const PROCESS = /* groq */ `{ statement, cards[]{ title, description, model } }`;

export const WORK_QUERY = /* groq */ `*[_type == "workProject"] | order(order asc) {
  "slug": slug.current,
  order,
  title,
  description,
  website,
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
  manifesto,
  team { titleLines, body, ctaLabel, ctaHref },
  preloader { locationLine, disciplineLine },
  notFound { title, body, linkLabel },
  "faq": coalesce(faq${FAQ}, *[_id == "faq"][0]${FAQ}),
  "process": coalesce(process${PROCESS}, *[_id == "process"][0]${PROCESS})
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

export const MARQUEE_QUERY = /* groq */ `coalesce(
  *[_id == "marquee" && defined(copy)][0]{ copy, enabled },
  *[_id == "nav"][0]{ "copy": availabilityLine, "enabled": false }
)`;

export const SOCIAL_QUERY = /* groq */ `coalesce(
  *[_id == "social" && defined(email)][0]{ email, instagram, discoveryCall },
  *[_id == "nav"][0]{
    "email": coalesce(email, socials[label == "Email"][0].href),
    "instagram": socials[label == "Instagram"][0].href,
    "discoveryCall": socials[label == "Discovery Call"][0].href
  }
)`;
