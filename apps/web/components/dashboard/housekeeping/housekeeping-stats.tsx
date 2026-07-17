import { StatGrid, type StatItem } from "../ui/stat-grid";
import type { HousekeepingTaskMetrics } from "../../../src/server/validators/housekeeping";
import { AlertIcon, CheckCircleIcon, ClockIcon, SparkleIcon } from "./icons";
import { UserIcon } from "../icons";

export function HousekeepingStats({ metrics }: { metrics: HousekeepingTaskMetrics }) {
  const stats: StatItem[] = [
    { id: "pending", label: "Pending", value: String(metrics.pending), icon: ClockIcon },
    { id: "assigned", label: "Assigned", value: String(metrics.assigned), icon: UserIcon },
    { id: "in_progress", label: "In progress", value: String(metrics.inProgress), icon: SparkleIcon },
    { id: "completed_today", label: "Completed today", value: String(metrics.completedToday), icon: CheckCircleIcon },
    { id: "overdue", label: "Overdue", value: String(metrics.overdue), icon: AlertIcon },
    { id: "urgent", label: "Urgent", value: String(metrics.urgent), icon: AlertIcon },
    { id: "unassigned", label: "Unassigned", value: String(metrics.unassigned), icon: UserIcon },
  ];

  return <StatGrid stats={stats} ariaLabel="Housekeeping statistics" />;
}
