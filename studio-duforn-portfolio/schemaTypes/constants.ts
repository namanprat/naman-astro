/** Same vocabulary the site tags projects with and lists on About. */
export const WORK_SERVICES = [
  "Brand identity",
  "Website design",
  "Website development",
  "Motion design",
  "3D",
] as const;

/** Desk order: Work and Archive sit above this list. */
export const SINGLETON_TYPES = [
  "site",
  "marquee",
  "social",
  "footer",
  "about",
] as const;

export type SingletonType = (typeof SINGLETON_TYPES)[number];

/** Desk id / document _id for each singleton so GROQ and Studio agree. */
export const SINGLETON_IDS = {
  site: "site",
  marquee: "marquee",
  social: "social",
  footer: "footer",
  about: "about",
} as const satisfies Record<SingletonType, string>;
