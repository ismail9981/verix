"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Reveal, RevealItem } from "../../landing/reveal";
import { PaymentsIcon, AnalyticsIcon } from "../../landing/icons";
import { InvoiceIcon, PropertyManagementIcon, ReservationIcon } from "../icons";
import { StatGrid, type StatItem } from "../ui/stat-grid";
import { DashboardFiltersBar } from "./dashboard-filters";
import { RevenueSection } from "./revenue-section";
import { OccupancyCard } from "./occupancy-card";
import { OutstandingInvoicesCard } from "./outstanding-invoices-card";
import { ReservationsTrendCard } from "./reservations-trend-card";
import { ActivityTimeline } from "./activity-timeline";
import { TodaysReservationsCard } from "./todays-reservations-card";
import { formatMoney } from "../invoices/invoice-format";
import type {
  DashboardAnalyticsData,
  DashboardAnalyticsRange,
} from "../../../src/server/validators/dashboard-analytics";
import {
  dashboardAnalyticsFiltersSchema,
  dashboardAnalyticsQueryString,
} from "../../../src/server/validators/dashboard-analytics";

interface DashboardAnalyticsManagerProps {
  data: DashboardAnalyticsData;
  range: DashboardAnalyticsRange;
  from: string;
  to: string;
}

/*
 * Client orchestrator for the dashboard's analytics widgets (Sprint 18).
 * Mirrors `components/dashboard/analytics/analytics-manager.tsx`'s own
 * URL-searchParams-driven filter pattern exactly (debounced state ->
 * `router.replace` -> the Server Component re-fetches and passes fresh
 * `data` back down as a prop) — deliberately not shared code with that file
 * (see `dashboard-filters.tsx`'s note), just the same, already-proven UX
 * pattern applied independently.
 */
export function DashboardAnalyticsManager({
  data,
  range: initialRange,
  from: initialFrom,
  to: initialTo,
}: DashboardAnalyticsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [range, setRange] = useState<DashboardAnalyticsRange>(initialRange);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [isPending, startTransition] = useTransition();

  const draft = dashboardAnalyticsFiltersSchema.safeParse({ range, from, to });
  const draftQuery = draft.success ? dashboardAnalyticsQueryString(draft.data) : null;
  const currentQuery = searchParams.toString();
  const filtersChanging = draftQuery !== null && draftQuery !== currentQuery;

  const navigate = useCallback(
    (query: string) => {
      if (query === currentQuery) return;
      startTransition(() => {
        router.replace(`${pathname}?${query}`, { scroll: false });
      });
    },
    [currentQuery, pathname, router],
  );

  // Server props are authoritative after back/forward navigation or any
  // external URL change. Keep the controlled inputs synchronized with them.
  useEffect(() => {
    setRange(initialRange);
    setFrom(initialFrom);
    setTo(initialTo);
  }, [initialFrom, initialRange, initialTo]);

  // Debounce valid filter changes. Invalid/partial custom drafts stay local
  // with an inline explanation and never change the authoritative URL/data.
  useEffect(() => {
    if (!draftQuery) return;
    const timer = window.setTimeout(() => navigate(draftQuery), 300);
    return () => window.clearTimeout(timer);
  }, [draftQuery, navigate]);

  const { kpis, canViewFinancials } = data;

  const stats: StatItem[] = [
    ...(canViewFinancials
      ? [
          {
            id: "revenue",
            label: "Revenue collected",
            value: formatMoney(kpis.revenueCollectedCents, kpis.currency),
            icon: PaymentsIcon,
          },
          {
            id: "outstanding",
            label: "Outstanding (today)",
            value: formatMoney(kpis.outstandingCents, kpis.currency),
            icon: InvoiceIcon,
          },
        ]
      : []),
    {
      id: "reservations",
      label: "Reservations",
      value: String(kpis.reservationsCount),
      icon: ReservationIcon,
    },
    {
      id: "occupancy",
      label: "Occupancy (today)",
      value: `${kpis.occupancyRatePercent}%`,
      icon: PropertyManagementIcon,
    },
    ...(canViewFinancials
      ? [
          {
            id: "average-payment",
            label: "Avg payment collected",
            value: formatMoney(kpis.averagePaymentCents, kpis.currency),
            icon: AnalyticsIcon,
          },
        ]
      : []),
  ];

  return (
    <Reveal as="div" className="flex flex-col gap-6">
      <RevealItem>
        <DashboardFiltersBar
          range={range}
          from={from}
          to={to}
          onRange={setRange}
          onFrom={setFrom}
          onTo={setTo}
          error={draft.success ? undefined : draft.error.issues[0]?.message}
        />
      </RevealItem>

      <div
        aria-busy={isPending || filtersChanging}
        className={`flex flex-col gap-6 transition-opacity ${isPending || filtersChanging ? "opacity-60" : ""}`}
      >
        <RevealItem>
          <StatGrid
            stats={stats}
            ariaLabel="Dashboard analytics summary"
            gridClassName={canViewFinancials ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-2"}
          />
        </RevealItem>

        <RevealItem>
          <div className={`grid grid-cols-1 gap-6 ${canViewFinancials ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
            {canViewFinancials ? (
              <div className="lg:col-span-2">
                <RevenueSection revenue={data.revenue} />
              </div>
            ) : (
              <ReservationsTrendCard points={data.reservationsPerDay} snapshot={data.reservationSnapshot} />
            )}
            <OccupancyCard occupancy={data.occupancy} />
          </div>
        </RevealItem>

        <RevealItem>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {canViewFinancials ? (
              <ReservationsTrendCard points={data.reservationsPerDay} snapshot={data.reservationSnapshot} />
            ) : null}
            {canViewFinancials ? (
              <OutstandingInvoicesCard outstanding={data.outstandingInvoices} />
            ) : null}
            <TodaysReservationsCard reservations={data.todaysReservations} />
          </div>
        </RevealItem>

        <RevealItem>
          <ActivityTimeline activity={data.activity} />
        </RevealItem>
      </div>
    </Reveal>
  );
}
