import Link from "next/link";
import { SectionCard } from "./section-card";

export interface HousekeepingDashboardSummary {
  pending: number;
  inProgress: number;
  overdue: number;
  unitsUnderCleaning: number;
  unitsUnderMaintenance: number;
}

/* Compact Housekeeping summary (Sprint 13) — the one real-data card in an
   otherwise mock-data dashboard (see `mock-data.ts`); every other card here
   predates real service wiring, so this is deliberately scoped to just this
   card + the small prop threading in `page.tsx`/`dashboard-home.tsx`, not a
   full conversion of the dashboard to live data. */
export function HousekeepingSummaryCard({
  summary,
}: {
  summary: HousekeepingDashboardSummary | null;
}) {
  if (!summary) return null;

  const rows: [string, number][] = [
    ["Pending", summary.pending],
    ["In progress", summary.inProgress],
    ["Overdue", summary.overdue],
    ["Units under cleaning", summary.unitsUnderCleaning],
    ["Units under maintenance", summary.unitsUnderMaintenance],
  ];

  return (
    <SectionCard
      id="housekeeping-summary"
      title="Housekeeping"
      action={
        <Link href="/housekeeping" className="text-xs font-medium text-accent hover:text-accent-strong">
          View all
        </Link>
      }
    >
      <dl className="flex flex-col divide-y divide-hairline">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-sm font-semibold text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
