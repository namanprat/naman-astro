import "./ViewSwitcher.css";

type ViewSwitcherItem<T extends string> = { id: T; label: string };

type ViewSwitcherProps<T extends string> = {
  views: readonly ViewSwitcherItem<T>[];
  view: T;
  busy?: boolean;
  onSelect: (id: T) => void;
  label: string;
  /** Lock ink to white/black (archive ground), ignoring page theme. */
  locked?: boolean;
};

export default function ViewSwitcher<T extends string>({
  views,
  view,
  busy = false,
  onSelect,
  label,
  locked = false,
}: ViewSwitcherProps<T>) {
  return (
    <div
      className={
        locked ? "view-switcher view-switcher--locked" : "view-switcher"
      }
      role="tablist"
      aria-label={label}
      data-busy={busy || undefined}
    >
      {views.map(({ id, label: tabLabel }) => (
        <button
          key={id}
          type="button"
          role="tab"
          className="view-switcher__tab text-style-mono"
          aria-selected={view === id}
          disabled={busy}
          onClick={() => onSelect(id)}
        >
          {tabLabel}
        </button>
      ))}
    </div>
  );
}
