import {
  animateIn,
  isLeavePending,
  markCovered,
  markLeavePending,
  PT_COVER_KEY,
  resetPageTransition,
} from "./pageTransition";
import { writeFlag } from "./sessionFlag";

export type GoOptions = {
  /** Menu overlay already covers the viewport — skip the rising-panel cover. */
  alreadyCovered?: boolean;
};

/** Full-document navigation with block-reveal cover. */
export async function go(href: string, options?: GoOptions): Promise<void> {
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

  /* A second click (home slider after Back restores a covered document, or
     a double tap while the panel is rising) must still leave. Re-tweening
     the same panel is what left `go()` waiting on a killed timeline. */
  if (isLeavePending()) {
    writeFlag(PT_COVER_KEY, "1");
    window.location.assign(href);
    return;
  }

  markLeavePending();
  try {
    if (options?.alreadyCovered) {
      markCovered();
    } else {
      await animateIn();
    }
    writeFlag(PT_COVER_KEY, "1");
    window.location.assign(href);
  } catch {
    resetPageTransition();
  }
}
