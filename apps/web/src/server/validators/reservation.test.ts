import { describe, it, expect } from "vitest";
import {
  INITIAL_RESERVATION_STATUSES,
  RESERVATION_STATUSES,
  computeMonthGridRange,
  doDateRangesOverlap,
  getValidTransitionsFrom,
  isEmployeeAllowedTransition,
  isReservationBlockingStatus,
  isValidInitialStatus,
  isValidReservationStatusTransition,
  reservationInputSchema,
  resolveReservationScope,
  workspaceTodayDate,
  type ReservationStatusValue,
} from "./reservation";

describe("isValidReservationStatusTransition", () => {
  it("allows the documented forward transitions", () => {
    expect(isValidReservationStatusTransition("inquiry", "pending")).toBe(true);
    expect(isValidReservationStatusTransition("inquiry", "confirmed")).toBe(true);
    expect(isValidReservationStatusTransition("inquiry", "cancelled")).toBe(true);
    expect(isValidReservationStatusTransition("pending", "confirmed")).toBe(true);
    expect(isValidReservationStatusTransition("pending", "cancelled")).toBe(true);
    expect(isValidReservationStatusTransition("confirmed", "checked_in")).toBe(true);
    expect(isValidReservationStatusTransition("confirmed", "cancelled")).toBe(true);
    expect(isValidReservationStatusTransition("confirmed", "no_show")).toBe(true);
    expect(isValidReservationStatusTransition("checked_in", "checked_out")).toBe(true);
  });

  it("rejects transitions that skip or reverse the lifecycle", () => {
    expect(isValidReservationStatusTransition("inquiry", "checked_in")).toBe(false);
    expect(isValidReservationStatusTransition("pending", "checked_in")).toBe(false);
    expect(isValidReservationStatusTransition("confirmed", "pending")).toBe(false);
    expect(isValidReservationStatusTransition("checked_in", "confirmed")).toBe(false);
  });

  it("treats checked_out, cancelled, and no_show as terminal", () => {
    for (const terminal of ["checked_out", "cancelled", "no_show"] as const) {
      for (const candidate of RESERVATION_STATUSES) {
        expect(isValidReservationStatusTransition(terminal, candidate)).toBe(false);
      }
    }
  });

  it("rejects a no-op transition (same status)", () => {
    for (const status of RESERVATION_STATUSES) {
      expect(isValidReservationStatusTransition(status, status)).toBe(false);
    }
  });
});

describe("isEmployeeAllowedTransition", () => {
  it("allows only the narrow operational subset", () => {
    expect(isEmployeeAllowedTransition("confirmed", "checked_in")).toBe(true);
    expect(isEmployeeAllowedTransition("checked_in", "checked_out")).toBe(true);
    expect(isEmployeeAllowedTransition("confirmed", "no_show")).toBe(true);
  });

  it("rejects transitions outside the employee subset even if otherwise valid", () => {
    expect(isEmployeeAllowedTransition("inquiry", "confirmed")).toBe(false);
    expect(isEmployeeAllowedTransition("pending", "cancelled")).toBe(false);
    expect(isEmployeeAllowedTransition("confirmed", "cancelled")).toBe(false);
  });
});

describe("isReservationBlockingStatus", () => {
  it("treats cancelled and no_show as non-blocking", () => {
    expect(isReservationBlockingStatus("cancelled")).toBe(false);
    expect(isReservationBlockingStatus("no_show")).toBe(false);
  });
  it("treats every other status as blocking", () => {
    const blocking: ReservationStatusValue[] = ["inquiry", "pending", "confirmed", "checked_in", "checked_out"];
    for (const status of blocking) {
      expect(isReservationBlockingStatus(status)).toBe(true);
    }
  });
});

describe("doDateRangesOverlap", () => {
  it("detects a genuine overlap", () => {
    expect(doDateRangesOverlap("2026-07-01", "2026-07-05", "2026-07-03", "2026-07-08")).toBe(true);
  });
  it("detects one range fully containing another", () => {
    expect(doDateRangesOverlap("2026-07-01", "2026-07-10", "2026-07-03", "2026-07-05")).toBe(true);
  });
  it("does not flag adjacent stays (checkout == next check-in) as overlapping", () => {
    expect(doDateRangesOverlap("2026-07-01", "2026-07-05", "2026-07-05", "2026-07-08")).toBe(false);
  });
  it("does not flag disjoint ranges", () => {
    expect(doDateRangesOverlap("2026-07-01", "2026-07-03", "2026-07-10", "2026-07-12")).toBe(false);
  });
});

describe("resolveReservationScope", () => {
  it("gives owners and managers full scope", () => {
    expect(resolveReservationScope("owner", "tm1")).toEqual({ kind: "all" });
    expect(resolveReservationScope("manager", null)).toEqual({ kind: "all" });
  });
  it("scopes employees to their own team-member id", () => {
    expect(resolveReservationScope("employee", "tm1")).toEqual({
      kind: "assigned",
      teamMemberId: "tm1",
    });
  });
});

describe("reservationInputSchema", () => {
  const base = {
    unitId: "11111111-1111-4111-8111-111111111111",
    customerId: "22222222-2222-4222-8222-222222222222",
    checkInDate: "2026-08-01",
    checkOutDate: "2026-08-05",
    amount: "150.00",
    source: "direct",
    status: "inquiry",
  };

  it("accepts the exact YYYY-MM-DD string a native <input type=date> emits", () => {
    const result = reservationInputSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects check-out on or before check-in", () => {
    const result = reservationInputSchema.safeParse({
      ...base,
      checkInDate: "2026-08-05",
      checkOutDate: "2026-08-05",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = reservationInputSchema.safeParse({ ...base, amount: "-10" });
    expect(result.success).toBe(false);
  });

  it("converts amount from a coerced string without losing precision intent", () => {
    const result = reservationInputSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(150);
  });

  it("ignores a submitted currency field instead of erroring — currency is never client-supplied", () => {
    const result = reservationInputSchema.safeParse({ ...base, currency: "eur" });
    expect(result.success).toBe(true);
    if (result.success) expect("currency" in result.data).toBe(false);
  });
});

describe("isValidInitialStatus", () => {
  it("allows every documented starting status", () => {
    for (const status of INITIAL_RESERVATION_STATUSES) {
      expect(isValidInitialStatus(status)).toBe(true);
    }
  });

  it("rejects statuses only reachable via a transition", () => {
    for (const status of ["checked_in", "checked_out", "cancelled", "no_show"] as const) {
      expect(isValidInitialStatus(status)).toBe(false);
    }
  });
});

describe("getValidTransitionsFrom", () => {
  it("matches isValidReservationStatusTransition for every status pair", () => {
    for (const from of RESERVATION_STATUSES) {
      for (const to of RESERVATION_STATUSES) {
        expect(getValidTransitionsFrom(from).includes(to)).toBe(
          isValidReservationStatusTransition(from, to),
        );
      }
    }
  });

  it("returns no transitions for terminal statuses", () => {
    for (const terminal of ["checked_out", "cancelled", "no_show"] as const) {
      expect(getValidTransitionsFrom(terminal)).toEqual([]);
    }
  });
});

describe("computeMonthGridRange", () => {
  it("pads the range to full weeks starting Sunday", () => {
    // July 2026: the 1st is a Wednesday, so the grid should start on Sunday June 28.
    const { start, end } = computeMonthGridRange("2026-07");
    expect(start).toBe("2026-06-28");
    // The 31st (Friday) pads out to Saturday Aug 1; end is exclusive, so Aug 2.
    expect(end).toBe("2026-08-02");
  });

  it("produces a range whose every day-of-week aligns to a 7-day grid", () => {
    const { start, end } = computeMonthGridRange("2026-02");
    const days = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
    expect(days % 7).toBe(0);
  });
});

describe("workspaceTodayDate", () => {
  it("returns the UTC date for an unrecognized/UTC timezone", () => {
    expect(workspaceTodayDate("utc", new Date("2026-07-16T02:00:00Z"))).toBe("2026-07-16");
  });

  it("returns the local date for a West-of-UTC timezone even when UTC has already rolled to the next day", () => {
    // 2am UTC on July 16 is 7pm July 15 in Los Angeles (UTC-7 in July, DST).
    expect(workspaceTodayDate("america-los_angeles", new Date("2026-07-16T02:00:00Z"))).toBe(
      "2026-07-15",
    );
  });

  it("returns the local date for an East-of-UTC timezone even when UTC is still on the previous day", () => {
    // 11pm UTC on July 15 is already 1am July 16 in Paris (UTC+2 in July, DST).
    expect(workspaceTodayDate("europe-paris", new Date("2026-07-15T23:00:00Z"))).toBe("2026-07-16");
  });

  it("falls back to UTC for an unrecognized timezone value rather than throwing", () => {
    expect(() => workspaceTodayDate("mars-olympus_mons", new Date("2026-07-16T12:00:00Z"))).not.toThrow();
    expect(workspaceTodayDate("mars-olympus_mons", new Date("2026-07-16T12:00:00Z"))).toBe("2026-07-16");
  });
});
