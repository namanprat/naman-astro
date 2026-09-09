/**
 * Site copy that is identity, not CMS. Manifesto, team, preloader, and 404
 * change with a deploy.
 *
 * ponytail: same class as `src/consts.ts`. Homepage eyebrow, FAQ, and process
 * stay in the `site` collection; footer tagline and links have their own
 * collection. View-switcher labels live next to the controllers that own the
 * view ids.
 */
export const SITE_COPY = {
  manifesto:
    "We're a design practice for early-stage brands, closing the gap between who you already are and how the world sees you. Good design isn't about adding more. It's about knowing what to leave out.",
  team: {
    titleLines: ["We close", "that gap."],
    body: "Early on, every impression counts double. People decide whether you're worth their time before they read a word. We find what makes you different, build the whole presence around it, and make sure they feel that first.",
    ctaLabel: "View Work",
    ctaHref: "/work",
  },
  preloader: {
    locationLine: "Based in Mumbai and Bangalore, working worldwide",
    disciplineLine: "Brand, web, and motion for early-stage companies",
  },
  notFound: {
    title: "This page doesn't exist",
    body: "The page you're looking for may have moved, or the link that brought you here might be out of date.",
    linkLabel: "Back to home",
  },
} as const;
