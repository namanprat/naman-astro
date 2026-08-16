/**
 * Which /work view is showing, remembered for the session.
 *
 * Same shape as `workReturn.ts`: a single sessionStorage key wrapped in
 * try/catch so private mode just falls back to the default rather than
 * throwing on a page that is mid-boot.
 */
export type WorkView = "slider" | "grid";

const KEY = "work:view";
const DEFAULT: WorkView = "slider";

export function readWorkView(): WorkView {
  try {
    return sessionStorage.getItem(KEY) === "grid" ? "grid" : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function writeWorkView(view: WorkView) {
  try {
    sessionStorage.setItem(KEY, view);
  } catch {
    // blocked storage — the view just resets on the next load
  }
}
