import { describe, expect, it } from "vitest";
import {
  MAX_CUSTOM_RANGE_DAYS,
  billingPaymentToActivityEvent,
  buildDashboardOccupancySummary,
  buildOutstandingInvoicesSummary,
  canViewDashboardFinancials,
  dashboardAnalyticsFiltersSchema,
  dashboardAnalyticsQueryString,
  mergeDashboardActivity,
  resolveDashboardCalendarRange,
  summarizeDashboardPayments,
  type ActivityEvent,
} from "./dashboard-analytics";
import { resolveReservationScope, resolveTodayReservationOperation } from "./reservation";
import { UNIT_DISPLAY_STATUSES, type UnitDisplayStatus } from "./rental-unit";

function parse(input: { range: string; from?: string; to?: string }) {
  return dashboardAnalyticsFiltersSchema.parse(input);
}

function emptyStatuses(): Record<UnitDisplayStatus, number> {
  return Object.fromEntries(UNIT_DISPLAY_STATUSES.map((status) => [status, 0])) as Record<
    UnitDisplayStatus,
    number
  >;
}

describe("dashboard analytics date ranges", () => {
  const today = "2026-08-09";

  it.each([
    ["today", "2026-08-09", "2026-08-10"],
    ["7d", "2026-08-03", "2026-08-10"],
    ["30d", "2026-07-11", "2026-08-10"],
    ["month", "2026-08-01", "2026-08-10"],
  ] as const)("resolves the %s preset", (range, startDate, endDateExclusive) => {
    expect(resolveDashboardCalendarRange(parse({ range }), today)).toEqual({
      startDate,
      endDateExclusive,
    });
  });

  it("accepts a valid custom range and makes its next day the exclusive end", () => {
    const filters = parse({ range: "custom", from: "2026-02-27", to: "2026-03-01" });
    expect(resolveDashboardCalendarRange(filters, today)).toEqual({
      startDate: "2026-02-27",
      endDateExclusive: "2026-03-02",
    });
  });

  it.each([
    { range: "custom", from: "2026-01-01" },
    { range: "custom", to: "2026-01-01" },
  ])("rejects a partial custom range", (input) => {
    expect(dashboardAnalyticsFiltersSchema.safeParse(input).success).toBe(false);
  });

  it("rejects a reversed custom range", () => {
    expect(
      dashboardAnalyticsFiltersSchema.safeParse({
        range: "custom",
        from: "2026-02-02",
        to: "2026-02-01",
      }).success,
    ).toBe(false);
  });

  it.each(["not-a-date", "2026-02-30", "08/09/2026"])("rejects invalid date %s", (from) => {
    expect(
      dashboardAnalyticsFiltersSchema.safeParse({
        range: "custom",
        from,
        to: "2026-03-01",
      }).success,
    ).toBe(false);
  });

  it(`accepts ${MAX_CUSTOM_RANGE_DAYS} days and rejects a larger range`, () => {
    expect(
      dashboardAnalyticsFiltersSchema.safeParse({
        range: "custom",
        from: "2024-01-01",
        to: "2024-12-31",
      }).success,
    ).toBe(true);
    expect(
      dashboardAnalyticsFiltersSchema.safeParse({
        range: "custom",
        from: "2024-01-01",
        to: "2025-01-01",
      }).success,
    ).toBe(false);
  });

  it("builds canonical URL state and drops stale custom dates for presets", () => {
    expect(
      dashboardAnalyticsQueryString(
        parse({ range: "custom", from: "2026-08-01", to: "2026-08-09" }),
      ),
    ).toBe("range=custom&from=2026-08-01&to=2026-08-09");
    expect(
      dashboardAnalyticsQueryString(
        parse({ range: "7d", from: "2020-01-01", to: "2020-01-02" }),
      ),
    ).toBe("range=7d");
  });
});

describe("dashboard analytics calculations", () => {
  it("calculates net revenue and average collected charge from matching payment facts", () => {
    expect(
      summarizeDashboardPayments({ chargeCents: 30_000, refundCents: 5_000, chargeCount: 2 }),
    ).toEqual({ netRevenueCents: 25_000, averagePaymentCents: 15_000 });
  });

  it("returns zero payment metrics for an empty workspace", () => {
    expect(summarizeDashboardPayments({ chargeCents: 0, refundCents: 0, chargeCount: 0 })).toEqual({
      netRevenueCents: 0,
      averagePaymentCents: 0,
    });
  });

  it("orders outstanding invoices and retains the independently aggregated total", () => {
    const summary = buildOutstandingInvoicesSummary(
      [
        { id: "a", number: "INV-1", customerName: "A", outstandingCents: 2_000, currency: "USD" },
        { id: "b", number: "INV-2", customerName: "B", outstandingCents: 7_000, currency: "USD" },
        { id: "c", number: "INV-3", customerName: "C", outstandingCents: 4_000, currency: "USD" },
      ],
      13_000,
      "USD",
      2,
    );
    expect(summary.totalCents).toBe(13_000);
    expect(summary.topInvoices.map((invoice) => invoice.id)).toEqual(["b", "c"]);
  });

  it("maps all occupancy categories without treating blocked units as vacant", () => {
    const statusCounts = {
      ...emptyStatuses(),
      available: 4,
      occupied: 2,
      reserved: 1,
      cleaning: 1,
      maintenance: 1,
      out_of_service: 1,
    };
    const summary = buildDashboardOccupancySummary(statusCounts);
    expect(summary.unitCount).toBe(10);
    expect(summary.occupancyRatePercent).toBe(20);
    expect(summary.statusCounts).toEqual(statusCounts);
  });

  it("returns a zero occupancy percentage for an empty workspace", () => {
    expect(buildDashboardOccupancySummary(emptyStatuses())).toMatchObject({
      unitCount: 0,
      occupancyRatePercent: 0,
    });
  });
});

describe("dashboard permissions and activity", () => {
  it("allows financial widgets only for owner and manager", () => {
    expect(canViewDashboardFinancials("owner")).toBe(true);
    expect(canViewDashboardFinancials("manager")).toBe(true);
    expect(canViewDashboardFinancials("employee")).toBe(false);
  });

  it("keeps employee reservation scope assigned to their team-member id", () => {
    expect(resolveReservationScope("employee", "member-1")).toEqual({
      kind: "assigned",
      teamMemberId: "member-1",
    });
    expect(resolveReservationScope("employee", null)).toEqual({ kind: "none" });
  });

  it("uses voidedAt as the effective timestamp for an old payment voided recently", () => {
    const event = billingPaymentToActivityEvent({
      id: "payment-1",
      type: "charge",
      amountCents: 1_000,
      currency: "USD",
      method: "card",
      createdAt: new Date("2025-01-01T00:00:00Z"),
      paidAt: new Date("2025-01-01T00:00:00Z"),
      voidedAt: new Date("2026-08-09T12:00:00Z"),
    });
    expect(event.type).toBe("billing.payment_voided");
    expect(event.timestamp.toISOString()).toBe("2026-08-09T12:00:00.000Z");
  });

  it("merges activity by effective timestamp before applying the limit", () => {
    const event = (id: string, timestamp: string): ActivityEvent => ({
      id,
      domain: "reservations",
      type: "reservations.created",
      timestamp: new Date(timestamp),
      title: id,
    });
    expect(
      mergeDashboardActivity(
        [
          [event("old", "2026-01-01T00:00:00Z")],
          [event("new", "2026-02-01T00:00:00Z")],
        ],
        1,
      ).map((item) => item.id),
    ).toEqual(["new"]);
  });

  it("classifies today's operational reservation rows without financial data", () => {
    expect(
      resolveTodayReservationOperation({
        status: "confirmed",
        checkInDate: "2026-08-09",
        today: "2026-08-09",
      }),
    ).toBe("arrival");
    expect(
      resolveTodayReservationOperation({
        status: "checked_in",
        checkInDate: "2026-08-08",
        today: "2026-08-09",
      }),
    ).toBe("in_house");
    expect(
      resolveTodayReservationOperation({
        status: "checked_out",
        checkInDate: "2026-08-01",
        today: "2026-08-09",
      }),
    ).toBe("departure");
  });
});
