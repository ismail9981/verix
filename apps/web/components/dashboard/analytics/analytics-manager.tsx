"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Reveal, RevealItem } from "../../landing/reveal";
import { CheckIcon, PaymentsIcon } from "../../landing/icons";
import { ClockIcon } from "../home/icons";
import { CalendarIcon } from "../bookings/icons";
import { TeamIcon, UserIcon } from "../icons";
import { StatGrid, type StatItem } from "../ui/stat-grid";
import {
  ProfileToast,
  type ToastState,
} from "../business-profile/profile-toast";
import { AnalyticsFiltersBar } from "./analytics-filters";
import { AnalyticsHeader } from "./analytics-header";
import { RevenueChart } from "./revenue-chart";
import { DistributionCard } from "./distribution-card";
import {
  BookingsPerDay,
  NewCustomers,
  TopBookedServices,
} from "./trend-cards";
import {
  RecentBookingsTable,
  RecentPaymentsTable,
  TopCustomersTable,
  TopServicesTable,
} from "./analytics-tables";
import {
  BOOKING_STATUS_CONFIG,
  PAYMENT_METHOD_CONFIG,
  PAYMENT_STATUS_CONFIG,
  formatMoney,
  toSegments,
} from "./analytics-format";
import { refreshAnalyticsAction } from "../../../src/server/actions/analytics";
import type {
  AnalyticsData,
  AnalyticsPoint,
  AnalyticsRange,
} from "../../../src/server/validators/analytics";

interface AnalyticsManagerProps {
  data: AnalyticsData;
  range: AnalyticsRange;
  from: string;
  to: string;
}

export function AnalyticsManager({
  data,
  range: initialRange,
  from: initialFrom,
  to: initialTo,
}: AnalyticsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [range, setRange] = useState<AnalyticsRange>(initialRange);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const navigate = useCallback(
    (nextRange: AnalyticsRange, nextFrom: string, nextTo: string) => {
      const params = new URLSearchParams();
      params.set("range", nextRange);
      if (nextRange === "custom") {
        if (nextFrom) params.set("from", nextFrom);
        if (nextTo) params.set("to", nextTo);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router],
  );

  // Debounce filter changes; skip the initial mount (already matches URL).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    // Custom range only queries once both bounds are set.
    if (range === "custom" && (!from || !to)) return;
    const timer = window.setTimeout(() => navigate(range, from, to), 300);
    return () => window.clearTimeout(timer);
  }, [range, from, to, navigate]);

  function handleRefresh() {
    startTransition(async () => {
      const result = await refreshAnalyticsAction();
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  const { kpis } = data;
  const statItems: StatItem[] = [
    { id: "revenue", label: "Total revenue", value: formatMoney(kpis.totalRevenueCents), icon: PaymentsIcon },
    { id: "customers", label: "Total customers", value: String(kpis.totalCustomers), icon: TeamIcon },
    { id: "bookings", label: "Total bookings", value: String(kpis.totalBookings), icon: CalendarIcon },
    { id: "services", label: "Active services", value: String(kpis.activeServices), icon: CheckIcon },
    { id: "avg-booking", label: "Avg booking value", value: formatMoney(kpis.avgBookingValueCents), icon: ClockIcon },
    { id: "avg-spend", label: "Avg customer spend", value: formatMoney(kpis.avgCustomerSpendCents), icon: UserIcon },
  ];

  const topBookedServices: AnalyticsPoint[] = data.topServices.map((s) => ({
    label: s.name,
    value: s.bookings,
  }));

  return (
    <>
      <Reveal
        as="div"
        className={`flex flex-col gap-6 transition-opacity ${isPending ? "opacity-70" : ""}`}
      >
        <RevealItem>
          <AnalyticsHeader onRefresh={handleRefresh} refreshing={isPending} />
        </RevealItem>
        <RevealItem>
          <AnalyticsFiltersBar
            range={range}
            from={from}
            to={to}
            onRange={setRange}
            onFrom={setFrom}
            onTo={setTo}
          />
        </RevealItem>
        <RevealItem>
          <StatGrid stats={statItems} ariaLabel="Key metrics" />
        </RevealItem>
        <RevealItem>
          <RevenueChart
            daily={data.revenue.daily}
            weekly={data.revenue.weekly}
            monthly={data.revenue.monthly}
          />
        </RevealItem>
        <RevealItem>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DistributionCard
              id="booking-status"
              title="Booking status distribution"
              segments={toSegments(data.bookingStatus, BOOKING_STATUS_CONFIG)}
            />
            <BookingsPerDay points={data.bookingsPerDay} />
          </div>
        </RevealItem>
        <RevealItem>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <NewCustomers points={data.newCustomers} />
            <TopBookedServices points={topBookedServices} />
          </div>
        </RevealItem>
        <RevealItem>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DistributionCard
              id="payment-methods"
              title="Payment methods"
              segments={toSegments(data.paymentMethods, PAYMENT_METHOD_CONFIG)}
            />
            <DistributionCard
              id="payment-status"
              title="Payment status distribution"
              segments={toSegments(data.paymentStatus, PAYMENT_STATUS_CONFIG)}
            />
          </div>
        </RevealItem>
        <RevealItem>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RecentBookingsTable rows={data.recentBookings} />
            <RecentPaymentsTable rows={data.recentPayments} />
          </div>
        </RevealItem>
        <RevealItem>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TopCustomersTable rows={data.topCustomers} />
            <TopServicesTable rows={data.topServices} />
          </div>
        </RevealItem>
      </Reveal>

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
