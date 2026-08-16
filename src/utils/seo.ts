import { NOINDEX_ROUTES } from "../consts.ts";

const normalize = (path: string) => `/${path.replace(/^\/+|\/+$/g, "")}`;

const excluded = new Set(NOINDEX_ROUTES.map(normalize));

export function isNoindexRoute(pathname: string): boolean {
  return excluded.has(normalize(pathname));
}

/** Normalized `NOINDEX_ROUTES` paths, used as `Disallow` rules in robots.txt. */
export function noindexDisallowPaths(): string[] {
  return [...excluded];
}
