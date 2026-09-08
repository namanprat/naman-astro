export type AboutData = {
  lead: string;
  clients: string[];
  services: string[];
};

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

export type NavData = {
  availabilityLine: string;
  availabilityCopies: number;
  email: string;
  stacks: NavStack[];
  socials: NavSocial[];
  overlayColumns: OverlayItem[][];
  sectionIds: string[];
};

export type ViewItem = {
  id: string;
  label: string;
};
