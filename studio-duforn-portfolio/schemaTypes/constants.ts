/** Same vocabulary the site tags projects with and lists on About. */
export const WORK_SERVICES = [
  "Brand identity",
  "Website design",
  "Website development",
  "Motion design",
  "3D",
] as const;

export const WORK_SPANS = [2, 3, 5] as const;

export const SINGLETON_TYPES = [
  "siteSettings",
  "aboutSettings",
  "faqSettings",
  "processSettings",
  "navSettings",
] as const;

export type SingletonType = (typeof SINGLETON_TYPES)[number];

/** Desk id / document _id for each singleton so GROQ and Studio agree. */
export const SINGLETON_IDS = {
  siteSettings: "site",
  aboutSettings: "about",
  faqSettings: "faq",
  processSettings: "process",
  navSettings: "nav",
} as const satisfies Record<SingletonType, string>;
