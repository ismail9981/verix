import { DistributionCard } from "../analytics/distribution-card";
import type { OccupancySummary } from "../../../src/server/validators/dashboard-analytics";

/*
 * Occupancy widget (Sprint 18) — a six-state unit-status donut,
 * reusing `DistributionCard`/`DonutChart` directly (both are generic,
 * domain-agnostic chart primitives already exported by the analytics
 * feature — see the reuse note in `revenue-section.tsx`). Not date-range
 * scoped: occupancy is always a current-state snapshot, same as
 * `getPropertyManagementMetrics` (the function this data comes from) itself
 * is — it takes no date range today. All segments and the percentage share
 * the same all-unit denominator, so unavailable units are never mislabeled as
 * vacant and the legend cannot disagree with the headline percentage.
 */
export function OccupancyCard({ occupancy }: { occupancy: OccupancySummary }) {
  return (
    <DistributionCard
      id="dashboard-occupancy"
      title={`Occupancy — ${occupancy.occupancyRatePercent}% of all units`}
      segments={[
        { label: "Vacant", value: occupancy.statusCounts.available, color: "#22c55e" },
        { label: "Reserved", value: occupancy.statusCounts.reserved, color: "#38bdf8" },
        { label: "Occupied", value: occupancy.statusCounts.occupied, color: "#6d5ef9" },
        { label: "Cleaning", value: occupancy.statusCounts.cleaning, color: "#f59e0b" },
        { label: "Maintenance", value: occupancy.statusCounts.maintenance, color: "#fb7185" },
        { label: "Out of service", value: occupancy.statusCounts.out_of_service, color: "#71717a" },
      ]}
    />
  );
}
