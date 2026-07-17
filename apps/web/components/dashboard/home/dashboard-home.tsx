import { ActivityCard } from "./activity-card";
import { AiInsightsCard } from "./ai-insights-card";
import { AppointmentsCard } from "./appointments-card";
import { HousekeepingSummaryCard, type HousekeepingDashboardSummary } from "./housekeeping-summary-card";
import { QuickActions } from "./quick-actions";
import { RevenueChart } from "./revenue-chart";
import { StatsGrid } from "./stats-grid";
import { WelcomeHeader } from "./welcome-header";

/* Dashboard Home. Composes the widgets into a responsive layout: a full-width
   welcome + stats row, a two-thirds / one-third content split, then a
   full-width quick-actions row. Everything below stacks to one column on
   small screens. `housekeepingSummary` is the one real-data prop threaded in
   from the server page (see that file's note) — everything else here is
   still mock data. */
export function DashboardHome({
  housekeepingSummary,
}: {
  housekeepingSummary: HousekeepingDashboardSummary | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      <WelcomeHeader />
      <StatsGrid />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <RevenueChart />
          <AppointmentsCard />
        </div>
        <div className="flex flex-col gap-6">
          <HousekeepingSummaryCard summary={housekeepingSummary} />
          <AiInsightsCard />
          <ActivityCard />
        </div>
      </div>

      <QuickActions />
    </div>
  );
}
