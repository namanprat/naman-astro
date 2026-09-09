import { NOINDEX_ROUTES } from "../consts.ts";

/**
 * Astro writes trailing-slash folder URLs (`/about/`, `/archive/`) into
 * `Astro.url.pathname` at build time. Route checks have to compare the
 * slash-free form or `/about` SSR still emits the overlay and `/archive`
 * still mounts the fluid canvas.
 */
export function pagePathname(pathname: string): string {
  return `/${pathname.replace(/^\/+|\/+$/g, "")}`;
}

const excluded = new Set(NOINDEX_ROUTES.map(pagePathname));

export function isNoindexRoute(pathname: string): boolean {
  return excluded.has(pagePathname(pathname));
}

/** Normalized `NOINDEX_ROUTES` paths, used as `Disallow` rules in robots.txt. */
export function noindexDisallowPaths(): string[] {
  return [...excluded];
}
