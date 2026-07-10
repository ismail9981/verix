import { StatGrid, type StatItem } from "../ui/stat-grid";

export function BookingStats({ stats }: { stats: StatItem[] }) {
  return <StatGrid stats={stats} ariaLabel="Booking statistics" />;
}
