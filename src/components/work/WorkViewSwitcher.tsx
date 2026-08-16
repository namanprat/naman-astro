import type { WorkView } from "../../lib/site/workView";

const VIEWS: { id: WorkView; label: string }[] = [
  { id: "slider", label: "Slider" },
  { id: "grid", label: "Grid" },
];

type WorkViewSwitcherProps = {
  view: WorkView;
  busy: boolean;
  onSelect: (view: WorkView) => void;
};

/** Grid / Slider toggle. Same pill as the archive Orb / Grid switcher. */
export default function WorkViewSwitcher({
  view,
  busy,
  onSelect,
}: WorkViewSwitcherProps) {
  return (
    <div
      className="work-view-switcher"
      role="tablist"
      aria-label="Work view"
      data-busy={busy || undefined}
    >
      {VIEWS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          className="work-view-switcher__tab text-style-mono"
          aria-selected={view === id}
          disabled={busy}
          onClick={() => onSelect(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
