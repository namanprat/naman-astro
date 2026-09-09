import {
  getArchiveViewSnapshot,
  resetArchiveToOrbView,
  setArchiveView,
  subscribeArchiveView,
} from "./archiveView";

/**
 * Archive view tabs live in Astro; this paints `aria-pressed` / `data-busy`
 * off the same store the R3F scene reads.
 */
export function bootArchiveSwitcher(): void {
  resetArchiveToOrbView();

  const switcher = document.querySelector<HTMLElement>("[data-view-switcher]");
  if (!switcher) return;

  const paint = () => {
    const { view, isMorphing } = getArchiveViewSnapshot();
    switcher.dataset.view = view;
    switcher.toggleAttribute("data-busy", isMorphing);
    for (const tab of switcher.querySelectorAll<HTMLButtonElement>(
      "[data-view-id]",
    )) {
      const id = tab.dataset.viewId;
      tab.setAttribute("aria-pressed", String(id === view));
      tab.disabled = isMorphing;
    }
  };

  switcher.addEventListener("click", (event) => {
    const tab = (event.target as Element | null)?.closest<HTMLButtonElement>(
      "[data-view-id]",
    );
    if (!tab || !switcher.contains(tab)) return;
    const next = tab.dataset.viewId;
    if (next === "orb" || next === "grid") setArchiveView(next);
  });

  subscribeArchiveView(paint);
  paint();
}
