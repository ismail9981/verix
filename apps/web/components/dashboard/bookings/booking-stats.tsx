import { StatGrid } from "../ui/stat-grid";
import { STATS } from "./mock-data";

export function BookingStats() {
  return <StatGrid stats={STATS} ariaLabel="Booking statistics" />;
}
