"use client";

import { useState } from "react";
import { Reveal, RevealItem } from "../../landing/reveal";
import { AnalyticsFiltersBar } from "./analytics-filters";
import { AnalyticsHeader } from "./analytics-header";
import { BookingsByService } from "./bookings-by-service";
import { CustomerGrowth } from "./customer-growth";
import { KpiCards } from "./kpi-cards";
import { RecentReports } from "./recent-reports";
import { RevenueChart } from "./revenue-chart";
import { TopServices } from "./top-services";
import { TrafficSources } from "./traffic-sources";
import type { AnalyticsFilters } from "./types";

const INITIAL_FILTERS: AnalyticsFilters = {
  range: "30d",
  service: "all",
  staff: "all",
};

export function AnalyticsView() {
  const [filters, setFilters] = useState<AnalyticsFilters>(INITIAL_FILTERS);

  return (
    <Reveal as="div" className="flex flex-col gap-6">
      <RevealItem>
        <AnalyticsHeader />
      </RevealItem>
      <RevealItem>
        <AnalyticsFiltersBar filters={filters} onChange={setFilters} />
      </RevealItem>
      <RevealItem>
        <KpiCards />
      </RevealItem>
      <RevealItem>
        <RevenueChart />
      </RevealItem>
      <RevealItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BookingsByService />
          <CustomerGrowth />
        </div>
      </RevealItem>
      <RevealItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TrafficSources />
          <TopServices />
        </div>
      </RevealItem>
      <RevealItem>
        <RecentReports />
      </RevealItem>
    </Reveal>
  );
}
