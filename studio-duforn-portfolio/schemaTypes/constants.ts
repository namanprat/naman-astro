/** Same vocabulary the site tags projects with and lists on About. */
export const WORK_SERVICES = [
  "Brand identity",
  "Website design",
  "Website development",
  "Motion design",
  "3D",
] as const;

export const SINGLETON_TYPES = [
  "siteSettings",
  "footerSettings",
  "aboutSettings",
  "marqueeSettings",
] as const;

export type SingletonType = (typeof SINGLETON_TYPES)[number];

/** Desk id / document _id for each singleton so GROQ and Studio agree. */
export const SINGLETON_IDS = {
  siteSettings: "site",
  footerSettings: "footer",
  aboutSettings: "about",
  marqueeSettings: "marquee",
} as const satisfies Record<SingletonType, string>;
