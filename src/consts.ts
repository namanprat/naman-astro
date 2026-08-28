/** Site name. Appended to every page title and used as `og:site_name`. */
export const SITE_NAME = "duforn";
/** Fallback meta description for pages that don't set their own. */
export const SITE_DESCRIPTION =
  "Based in Mumbai and Bangalore, working with clients everywhere. Brand, web, and motion for early-stage companies that refuse to look like everyone else.";
/** Canonical origin. Resolves canonical URLs, social images, and the sitemap. */
export const SITE_URL = "https://namanprat.com";
/**
 * Routes kept out of search results. Each is excluded from the sitemap,
 * listed as `Disallow` in robots.txt, and served with a
 * `robots: noindex, nofollow` tag, so the three can't disagree.
 *
 * Surrounding slashes are optional: `"/thanks"`, `"thanks"` and `"/thanks/"`
 * all match the same route.
 */
export const NOINDEX_ROUTES: string[] = ["/404", "/about"];
