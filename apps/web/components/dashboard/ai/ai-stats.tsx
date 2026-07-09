import { StatGrid } from "../ui/stat-grid";
import { STATS } from "./mock-data";

export function AiStats() {
  return <StatGrid stats={STATS} ariaLabel="AI overview" />;
}
