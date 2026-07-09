import { SectionCard } from "../home/section-card";
import { DownloadIcon } from "./icons";
import { REPORTS } from "./mock-data";

export function RecentReports() {
  return (
    <SectionCard id="reports" title="Recent reports" bodyClassName="p-2">
      <ul>
        {REPORTS.map((report) => (
          <li
            key={report.id}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-canvas"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {report.name}
              </p>
              <p className="truncate text-xs text-muted">
                {report.range} · Generated {report.date}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Download ${report.name}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
