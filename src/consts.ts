/**
 * The wordmark, as it is set on the page: lowercase, matching the lettering
 * drawn into `public/main-assets/name-hero.svg`. Anything a visitor reads on
 * the site itself uses this — the nav wordmark, the menu overlay title, and the
 * `aria-label` that stands in for the hero and preloader marks.
 */
export const SITE_NAME = "duforn";
/**
 * The same name as the browser says it: title bar, share cards, home-screen
 * label. Capitalised, because those live outside the site's own typography and
 * a lowercase `d` there reads as a typo rather than as the mark.
 */
export const SITE_TITLE = "Duforn";
/** Fallback meta description for pages that don't set their own. */
export const SITE_DESCRIPTION =
  "Based in Mumbai and Bangalore, working with clients everywhere. Brand, web, and motion for early-stage companies that refuse to look like everyone else.";
/** Canonical origin. Resolves canonical URLs, social images, and the sitemap. */
export const SITE_URL = "https://namanprat.com";
/** BCP 47 locale tag used to format dates and numbers. */
export const SITE_LOCALE = "en-IN";
/**
 * Routes kept out of search results. Each is excluded from the sitemap,
 * listed as `Disallow` in robots.txt, and served with a
 * `robots: noindex, nofollow` tag, so the three can't disagree.
 *
 * Surrounding slashes are optional: `"/thanks"`, `"thanks"` and `"/thanks/"`
 * all match the same route.
 */
export const NOINDEX_ROUTES: string[] = ["/404", "/about"];
