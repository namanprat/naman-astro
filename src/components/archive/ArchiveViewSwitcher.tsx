import {
  useArchiveViewStore,
  type ArchiveView,
} from "../../lib/archive/archiveView";

const VIEWS: { id: ArchiveView; label: string }[] = [
  { id: "orb", label: "Orb" },
  { id: "grid", label: "Grid" },
];

export default function ArchiveViewSwitcher() {
  const view = useArchiveViewStore((s) => s.view);
  const setView = useArchiveViewStore((s) => s.setView);
  const morphing = useArchiveViewStore((s) => s.isMorphing);

  return (
    <div
      className="archive-view-switcher"
      role="tablist"
      aria-label="Archive view"
      data-busy={morphing || undefined}
    >
      {VIEWS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          className="archive-view-switcher__tab text-style-mono"
          aria-selected={view === id}
          disabled={morphing}
          onClick={() => setView(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
