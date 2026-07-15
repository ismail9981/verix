import { StatGrid, type StatItem } from "../ui/stat-grid";
import { UserPlusIcon, TrendUpIcon } from "../home/icons";
import { CheckIcon } from "../../landing/icons";
import { InboxIcon, FlagIcon } from "./icons";
import type { LeadStats } from "../../../src/server/validators/lead";

export function LeadStatsGrid({ stats }: { stats: LeadStats }) {
  const items: StatItem[] = [
    { id: "total", label: "Total leads", value: String(stats.total), icon: InboxIcon },
    { id: "new", label: "New", value: String(stats.new), icon: UserPlusIcon },
    { id: "qualified", label: "Qualified", value: String(stats.qualified), icon: TrendUpIcon },
    { id: "converted", label: "Converted", value: String(stats.converted), icon: CheckIcon },
    { id: "spam", label: "Spam", value: String(stats.spam), icon: FlagIcon },
  ];
  return <StatGrid stats={items} ariaLabel="Lead statistics" />;
}
