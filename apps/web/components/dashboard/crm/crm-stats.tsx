import { StatGrid, type StatItem } from "../ui/stat-grid";

export function CrmStats({ stats }: { stats: StatItem[] }) {
  return <StatGrid stats={stats} ariaLabel="Customer statistics" />;
}
