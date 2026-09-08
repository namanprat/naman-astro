/**
 * Nav chrome. Routes, socials, and the overlay live here — not in Sanity —
 * because they are the site's wiring, not copy. The availability marquee is
 * the one line an editor should change without a deploy; that stays in the
 * `nav` collection.
 */
export type NavLink = {
  label: string;
  path: string;
  id: string;
};

export type NavStack = {
  col: string;
  links: NavLink[];
};

export type NavSocial = {
  label: string;
  href: string;
  newTab: boolean;
};

export type OverlayLink = { label: string; path: string };
export type OverlayAction = { label: string; action: "theme" };
export type OverlayItem = OverlayLink | OverlayAction;

export type NavMarquee = {
  availabilityLine: string;
  availabilityCopies: number;
};

export const EMAIL_HREF = "mailto:a.namanprat@gmail.com";

export const NAV_STACKS: NavStack[] = [
  {
    col: "is-home",
    links: [
      { label: "Home", path: "/", id: "hero" },
      { label: "Work", path: "/work", id: "work" },
    ],
  },
  {
    col: "is-about",
    links: [
      { label: "About", path: "/#about", id: "about" },
      { label: "Contact", path: "/#contact", id: "contact" },
    ],
  },
];

export const SOCIAL_LINKS: NavSocial[] = [
  { label: "Email", href: EMAIL_HREF, newTab: false },
  {
    label: "Instagram",
    href: "https://www.instagram.com/namanprat_",
    newTab: true,
  },
  {
    label: "Discovery Call",
    href: "https://cal.com/namanprat/discovery-call",
    newTab: true,
  },
];

export const OVERLAY_COLUMNS: OverlayItem[][] = [
  [
    { label: "Work", path: "/work" },
    { label: "About", path: "/#about" },
  ],
  [
    { label: "Archive", path: "/archive" },
    { label: "Switch theme", action: "theme" },
  ],
  [{ label: "Contact", path: "/#contact" }],
];

/** Home sections the nav scroll-spies, in document order. */
export const SECTION_IDS = ["hero", "team", "contact"] as const;
