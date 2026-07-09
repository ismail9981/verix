import { StatGrid } from "../ui/stat-grid";
import { STATS } from "./mock-data";

export function CrmStats() {
  return <StatGrid stats={STATS} ariaLabel="Customer statistics" />;
}
