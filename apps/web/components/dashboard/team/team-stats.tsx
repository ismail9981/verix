import { StatGrid } from "../ui/stat-grid";
import { STATS } from "./mock-data";

export function TeamStats() {
  return <StatGrid stats={STATS} ariaLabel="Team statistics" />;
}
