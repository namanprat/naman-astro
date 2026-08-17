/** Site name. Appended to every page title and used as `og:site_name`. */
export const SITE_NAME = "Naman Pratulya";
/** Fallback meta description for pages that don't set their own. */
export const SITE_DESCRIPTION =
  "Based out of Mumbai and Bangalore. Working with culture, curating digital experiences.";
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
/** `/gooey-lab` is temporary — drop it and the page once Safari has picked a
 *  filter variant. */
export const NOINDEX_ROUTES: string[] = ["/404", "/about", "/gooey-lab"];
