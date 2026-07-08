import { StatusPill } from "./status-pill";
import { OVERVIEW } from "./mock-data";

const TILES = [
  { label: "Status", render: () => <StatusPill status="Published" /> },
  { label: "Current theme", render: () => <span className="text-sm font-medium text-white">{OVERVIEW.theme}</span> },
  { label: "Published version", render: () => <span className="text-sm font-medium text-white">{OVERVIEW.version}</span> },
  { label: "Last updated", render: () => <span className="text-sm font-medium text-white">{OVERVIEW.lastUpdated}</span> },
];

export function WebsiteOverview() {
  return (
    <section
      aria-labelledby="overview-heading"
      className="rounded-2xl border border-hairline bg-surface/40 p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="overview-heading" className="text-sm font-semibold text-white">
          Website overview
        </h2>
        <span className="text-xs text-amber-400">
          {OVERVIEW.unpublishedChanges} unpublished changes
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {TILES.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-hairline bg-canvas/40 p-4"
          >
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className="mt-1.5">{tile.render()}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
