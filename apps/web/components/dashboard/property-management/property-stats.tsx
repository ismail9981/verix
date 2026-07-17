import { StatGrid, type StatItem } from "../ui/stat-grid";
import type { PropertyManagementMetrics } from "../../../src/server/services/rental-unit.service";
import {
  BuildingsIcon,
  CheckCircleIcon,
  PropertyIcon,
  SparklesIcon,
  TrendingUpIcon,
  UnitIcon,
  WrenchIcon,
} from "./icons";

export function PropertyStats({ metrics }: { metrics: PropertyManagementMetrics }) {
  const stats: StatItem[] = [
    { id: "properties", label: "Properties", value: String(metrics.propertyCount), icon: PropertyIcon },
    { id: "buildings", label: "Buildings", value: String(metrics.buildingCount), icon: BuildingsIcon },
    { id: "units", label: "Units", value: String(metrics.unitCount), icon: UnitIcon },
    { id: "occupancy", label: "Occupancy rate", value: `${metrics.occupancyRatePercent}%`, icon: TrendingUpIcon },
    { id: "available", label: "Available units", value: String(metrics.statusCounts.available), icon: CheckCircleIcon },
    { id: "cleaning", label: "Cleaning units", value: String(metrics.statusCounts.cleaning), icon: SparklesIcon },
    { id: "maintenance", label: "Maintenance units", value: String(metrics.statusCounts.maintenance), icon: WrenchIcon },
  ];

  return <StatGrid stats={stats} ariaLabel="Property management statistics" />;
}
