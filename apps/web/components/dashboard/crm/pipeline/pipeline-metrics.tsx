import { TrendUpIcon, UserPlusIcon } from "../../home/icons";
import { StarIcon, RepeatIcon } from "../icons";
import { StatGrid, type StatItem } from "../../ui/stat-grid";
import { formatMoney } from "./opportunity-format";
import type { CrmMetrics } from "../../../../src/server/services/crm-opportunity.service";

/* Sprint 10 CRM dashboard metrics: open/weighted pipeline value, won/lost this
   month, and follow-up load. Reuses the shared StatGrid (Bookings/CRM/AI). */
export function PipelineMetrics({ metrics }: { metrics: CrmMetrics }) {
  const stats: StatItem[] = [
    {
      id: "open-value",
      label: `Open pipeline (${metrics.openCount})`,
      value: formatMoney(metrics.openValueCents),
      icon: TrendUpIcon,
    },
    {
      id: "weighted-value",
      label: "Weighted value",
      value: formatMoney(metrics.weightedValueCents),
      icon: StarIcon,
    },
    {
      id: "won-month",
      label: "Won this month",
      value: `${metrics.wonThisMonthCount} · ${formatMoney(metrics.wonThisMonthValueCents)}`,
      icon: UserPlusIcon,
    },
    {
      id: "follow-ups",
      label: "Overdue / upcoming follow-ups",
      value: `${metrics.overdueFollowUps} / ${metrics.upcomingFollowUps}`,
      icon: RepeatIcon,
    },
  ];

  return <StatGrid stats={stats} ariaLabel="Pipeline metrics" />;
}
