/** Page metadata accepted by `BaseHead` and by every layout that renders it. */
export interface SeoProps {
  /** Page title. Rendered as `{title} | {SITE_NAME}`; omit for `SITE_NAME` alone. */
  title?: string;
  /** Meta description, also used for `og:description` and `twitter:description`. Defaults to `SITE_DESCRIPTION`. */
  description?: string;
  /**
   * Social share image. Relative paths resolve against `site` in
   * `astro.config.mjs`. Omitted entirely when unset — the image tags are
   * skipped rather than pointed at a file that may not exist.
   */
  image?: string;
}
