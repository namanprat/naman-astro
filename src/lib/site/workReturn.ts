/**
 * Hand-off for the reverse Flip when leaving a hard-loaded `/work/[slug]`.
 *
 * The overlay flow never needs this — it stays in one document and just
 * reverses. But a project page reached directly (shared link, refresh) has no
 * gallery behind it, so going back is a real navigation. This flag survives
 * that navigation and tells `/work` to open on the right slide and reverse
 * out, instead of booting cold.
 */
const KEY = "work:return";

/** Slug from a `/work/[slug]` pathname, or null for anything else. */
function slugFromWorkPath(pathname: string): string | null {
  return pathname.match(/^\/work\/([^/]+)\/?$/)?.[1] ?? null;
}

export function markWorkReturn(pathname = window.location.pathname): void {
  const slug = slugFromWorkPath(pathname);
  if (!slug) return;
  try {
    sessionStorage.setItem(KEY, slug);
  } catch {
    // private mode / blocked storage — the return just boots cold
  }
}

/** Read and clear. Consume this once per `/work` mount so a failed boot
    can't leave the gallery hidden on the next visit. */
export function takeWorkReturn(): string | null {
  try {
    const slug = sessionStorage.getItem(KEY);
    if (slug) sessionStorage.removeItem(KEY);
    return slug;
  } catch {
    return null;
  }
}
