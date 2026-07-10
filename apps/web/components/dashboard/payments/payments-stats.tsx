import { StatGrid, type StatItem } from "../ui/stat-grid";

export function PaymentsStats({ stats }: { stats: StatItem[] }) {
  return <StatGrid stats={stats} ariaLabel="Payment statistics" />;
}
