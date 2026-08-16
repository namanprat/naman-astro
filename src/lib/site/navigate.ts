import { animateIn, markCovered, PT_COVER_KEY } from "./pageTransition";

export type GoOptions = {
  /** Menu overlay already covers the viewport — skip the rising-panel cover. */
  alreadyCovered?: boolean;
};

/** Full-document navigation with block-reveal cover. */
export async function go(href: string, options?: GoOptions) {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    window.location.assign(href);
    return;
  }

  // Same path+search → hash-only; skip cover (Menu section jumps).
  if (
    url.origin === window.location.origin &&
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    window.location.assign(href);
    return;
  }

  if (options?.alreadyCovered) {
    markCovered();
  } else {
    await animateIn();
  }
  try {
    sessionStorage.setItem(PT_COVER_KEY, "1");
  } catch {
    /* private mode */
  }
  window.location.assign(href);
}
