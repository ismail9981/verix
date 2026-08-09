import { SectionCard } from "./section-card";
import { BarChart } from "../analytics/bar-chart";
import type {
  DashboardTrendPoint,
  ReservationOperationsSnapshot,
} from "../../../src/server/validators/dashboard-analytics";

/*
 * Reservations trend for the dashboard (Sprint 18) — reuses `BarChart`
 * directly (see the reuse note in `revenue-section.tsx`). The snapshot strip
 * (arrivals/departures/active stays) surfaces `getReservationMetrics`'s own
 * figures — a today-only, non-date-range-scoped snapshot, shown alongside
 * rather than folded into the trend chart, since it answers a different
 * question ("what's happening today") than the chart ("reservation volume
 * over the selected range").
 */
export function ReservationsTrendCard({
  points,
  snapshot,
}: {
  points: DashboardTrendPoint[];
  snapshot: ReservationOperationsSnapshot;
}) {
  const hasData = points.some((point) => point.value > 0);

  return (
    <SectionCard id="dashboard-reservations" title="Reservations">
      <dl className="mb-5 grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-xs text-muted">Arrivals today</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{snapshot.arrivalsToday}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Departures today</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{snapshot.departuresToday}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Active stays</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{snapshot.activeStays}</dd>
          </div>
      </dl>
      {hasData ? (
        <BarChart
          points={points}
          ariaLabel="Reservations created per day in this range."
        />
      ) : (
        <p className="py-12 text-center text-sm text-muted">No reservations in this range.</p>
      )}
    </SectionCard>
  );
}
