import { StatGrid, type StatItem } from "../ui/stat-grid";

export function TeamStats({ stats }: { stats: StatItem[] }) {
  return <StatGrid stats={stats} ariaLabel="Team statistics" />;
}
