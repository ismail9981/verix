import { StatGrid } from "../ui/stat-grid";
import { STATS } from "./mock-data";

export function PaymentsStats() {
  return <StatGrid stats={STATS} ariaLabel="Payment statistics" />;
}
