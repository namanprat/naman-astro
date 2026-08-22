/**
 * What `/work` remembers for the session: which view was showing, and whether
 * we are arriving back from a hard-loaded project page.
 *
 * Both were separate modules wrapping one sessionStorage key each, with the
 * same try/catch around both. They are the same concern — `/work`'s session
 * state — so they share a file and both defer to `sessionFlag`.
 */
import { readFlag, takeFlag, writeFlag } from "./sessionFlag";

export type WorkView = "slider" | "grid";

const VIEW_KEY = "work:view";
const DEFAULT_VIEW: WorkView = "slider";

/** Mirrored as a literal in `work.astro`'s inline boot script. */
const RETURN_KEY = "work:return";

export function readWorkView(): WorkView {
  return readFlag(VIEW_KEY) === "grid" ? "grid" : DEFAULT_VIEW;
}

export function writeWorkView(view: WorkView): void {
  writeFlag(VIEW_KEY, view);
}

/** Slug from a `/work/[slug]` pathname, or null for anything else. */
function slugFromWorkPath(pathname: string): string | null {
  return pathname.match(/^\/work\/([^/]+)\/?$/)?.[1] ?? null;
}

/**
 * Flag the reverse Flip when leaving a hard-loaded `/work/[slug]`.
 *
 * The overlay flow never needs this — it stays in one document and just
 * reverses. But a project page reached directly (shared link, refresh) has no
 * gallery behind it, so going back is a real navigation. This flag survives
 * that navigation and tells `/work` to open on the right slide and reverse
 * out, instead of booting cold.
 */
export function markWorkReturn(pathname = window.location.pathname): void {
  const slug = slugFromWorkPath(pathname);
  if (slug) writeFlag(RETURN_KEY, slug);
}

/**
 * Read and clear. Consume this once per `/work` mount so a failed boot can't
 * leave the gallery hidden on the next visit.
 */
export function takeWorkReturn(): string | null {
  return takeFlag(RETURN_KEY);
}
