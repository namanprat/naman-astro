/**
 * The moment the page actually becomes visible to the visitor.
 *
 * Three different things decide it — a plain load (immediately), the preloader
 * (on ENTER), and an inbound page transition (once the cover panel clears) —
 * and entrance animations need to fire on all three. pageTransition marks it;
 * anything that animates in waits on it.
 *
 * The flag lives on `<html>` rather than in module state because the listeners
 * are React islands that may hydrate after the mark, and because the marker and
 * the listeners are in separate bundles.
 */

export const PAGE_REVEALED_EVENT = "site:page-revealed";

const REVEALED_CLASS = "is-revealed";

export function isPageRevealed(): boolean {
  return document.documentElement.classList.contains(REVEALED_CLASS);
}

/** Idempotent — a second call after the first is a no-op. */
export function markPageRevealed(): void {
  if (isPageRevealed()) return;
  document.documentElement.classList.add(REVEALED_CLASS);
  window.dispatchEvent(new CustomEvent(PAGE_REVEALED_EVENT));
}
