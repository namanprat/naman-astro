/**
 * Nav chrome. Routes and the overlay live here — not in Sanity — because they
 * are the site's wiring, not copy. Social links are the `social` collection.
 * The availability marquee is copy plus on/off in the `marquee` collection.
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

export type OverlayLink = { label: string; path: string };
export type OverlayAction = { label: string; action: "theme" };
export type OverlayItem = OverlayLink | OverlayAction;

/** How many times the marquee line repeats in each track group. Layout, not CMS. */
export const MARQUEE_COPIES = 6;

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
