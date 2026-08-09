import { AiInsightsCard } from "./ai-insights-card";
import { DashboardAnalyticsManager } from "./dashboard-analytics-manager";
import { HousekeepingSummaryCard, type HousekeepingDashboardSummary } from "./housekeeping-summary-card";
import { QuickActions } from "./quick-actions";
import { WelcomeHeader } from "./welcome-header";
import type {
  DashboardAnalyticsData,
  DashboardAnalyticsRange,
} from "../../../src/server/validators/dashboard-analytics";

/* Dashboard Home (Sprint 18). Composes the widgets into a responsive layout:
   a full-width welcome header, the real, filterable analytics block (KPIs,
   revenue, occupancy, reservations, outstanding invoices, activity
   timeline — see `dashboard-analytics-manager.tsx`), a housekeeping summary
   + AI insights row, then a full-width quick-actions row. Housekeeping's
   summary is real but deliberately unfiltered by the analytics date range
   (it's always "right now" — see `page.tsx`'s separate, parallel fetch); AI
   Insights and Quick Actions remain static/mock, out of this sprint's scope. */
export function DashboardHome({
  analytics,
  range,
  from,
  to,
  housekeepingSummary,
}: {
  analytics: DashboardAnalyticsData;
  range: DashboardAnalyticsRange;
  from: string;
  to: string;
  housekeepingSummary: HousekeepingDashboardSummary | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      <WelcomeHeader />

      <DashboardAnalyticsManager data={analytics} range={range} from={from} to={to} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HousekeepingSummaryCard summary={housekeepingSummary} />
        <AiInsightsCard />
      </div>

      <QuickActions />
    </div>
  );
}
