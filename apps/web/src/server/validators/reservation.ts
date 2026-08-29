import { z } from "zod";
import { hasCapability } from "../auth/capabilities";
import { cleanOptional, hasAtMostCentsPrecision } from "./shared";

/*
 * Validation + pure decision logic for the Reservations feature (Sprint 11):
 * rental units (rooms/apartments/villas) booked for a check-in/check-out date
 * range. Dependency-free (no db/env imports) so every invariant here is
 * unit-testable — mirrors the split `crm-pipeline.ts` established between pure
 * decisions and `reservation.service.ts`'s DB access.
 *
 * Distinct from `booking.ts` (the pre-existing appointment/time-slot feature):
 * a reservation occupies a unit for whole calendar days, not a time slot.
 * Rental-unit-specific schemas/DTOs live in `rental-unit.ts`.
 */

export const RESERVATION_STATUSES = [
  "inquiry",
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;
export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_FILTER_STATUSES = [
  "all",
  ...RESERVATION_STATUSES,
] as const;
export type ReservationFilterStatus =
  (typeof RESERVATION_FILTER_STATUSES)[number];

export const RESERVATION_SOURCES = [
  "direct",
  "phone",
  "walk_in",
  "website",
  "other",
] as const;
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];

/**
 * The only statuses a reservation may be *created* in directly — every other
 * status is reachable only by walking the transition state machine below
 * (e.g. a reservation can't be created already `checked_in`; it must be
 * confirmed first, then checked in).
 */
export const INITIAL_RESERVATION_STATUSES = [
  "inquiry",
  "pending",
  "confirmed",
] as const;
export type InitialReservationStatus =
  (typeof INITIAL_RESERVATION_STATUSES)[number];

export function isValidInitialStatus(
  status: ReservationStatusValue,
): status is InitialReservationStatus {
  return (INITIAL_RESERVATION_STATUSES as readonly string[]).includes(status);
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/** Lean DTO (with joined unit/customer/staff names) sent to the client. */
export interface ReservationListItem {
  id: string;
  unitId: string;
  unitName: string;
  customerId: string;
  customerName: string;
  staffId: string | null;
  staffName: string | null;
  status: ReservationStatusValue;
  checkInDate: string;
  checkOutDate: string;
  priceCents: number;
  currency: string;
  source: ReservationSource;
  notes: string | null;
  createdAt: Date;
}

/** id/name pair for customer/staff selectors. */
export interface ReservationPersonOption {
  id: string;
  name: string;
}

export interface ReservationMetrics {
  arrivalsToday: number;
  departuresToday: number;
  activeStays: number;
  confirmedUpcoming: number;
  cancelledCount: number;
  revenueCents: number;
  /** The single currency all figures above are denominated in (see the currency-enforcement note on `reservationInputSchema`). */
  currency: string;
  occupancyRatePercent: number;
}

/** Non-financial, role-scoped operational snapshot used by the dashboard. */
export interface ReservationOperationsSnapshot {
  arrivalsToday: number;
  departuresToday: number;
  activeStays: number;
}

/** A reservation relevant to today's operations; intentionally excludes money. */
export interface ReservationTodayItem {
  id: string;
  customerName: string;
  unitName: string;
  propertyName: string;
  status: ReservationStatusValue;
  checkInDate: string;
  checkOutDate: string;
  operation: "arrival" | "departure" | "in_house";
}

export function resolveTodayReservationOperation(params: {
  status: ReservationStatusValue;
  checkInDate: string;
  today: string;
}): ReservationTodayItem["operation"] {
  if (params.status === "checked_in") return "in_house";
  return params.checkInDate === params.today ? "arrival" : "departure";
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * `amount` arrives in the major unit (dollars) — the service converts to
 * `priceCents`, exactly like `payment.ts`. There is deliberately no `currency`
 * field: every reservation is always priced in the workspace's own currency
 * (`workspaces.currency`), resolved server-side and never accepted from the
 * client. This keeps every reservation in a workspace directly comparable —
 * summing `priceCents` across reservations (e.g. for revenue metrics) would
 * silently mix currencies if a per-reservation override were allowed.
 */
export const reservationInputSchema = z
  .object({
    unitId: z.uuid("Select a unit"),
    customerId: z.uuid("Select a customer"),
    staffId: z.preprocess(cleanOptional, z.uuid().optional()),
    checkInDate: z.iso.date(),
    checkOutDate: z.iso.date(),
    amount: z.coerce
      .number()
      .min(0, "Can't be negative")
      .max(1_000_000, "Too large")
      .refine(
        hasAtMostCentsPrecision,
        "Amount can't have more than 2 decimal places",
      ),
    source: z.enum(RESERVATION_SOURCES).default("direct"),
    status: z.enum(RESERVATION_STATUSES).default("inquiry"),
    notes: z.preprocess(cleanOptional, z.string().max(1000).optional()),
  })
  .refine((value) => value.checkOutDate > value.checkInDate, {
    message: "Check-out date must be after the check-in date",
    path: ["checkOutDate"],
  });

export type ReservationInput = z.infer<typeof reservationInputSchema>;

export const reservationFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(RESERVATION_FILTER_STATUSES).catch("all"),
  unitId: z.union([z.literal("all"), z.uuid()]).catch("all"),
  staffId: z.union([z.literal("all"), z.uuid()]).catch("all"),
});

export type ReservationFilters = z.infer<typeof reservationFiltersSchema>;

export const reservationStatusInputSchema = z.object({
  status: z.enum(RESERVATION_STATUSES),
});
export type ReservationStatusInput = z.infer<
  typeof reservationStatusInputSchema
>;

// ---------------------------------------------------------------------------
// Pure decision logic
// ---------------------------------------------------------------------------

/**
 * The reservation lifecycle. `checked_out`, `cancelled`, and `no_show` are
 * terminal — nothing may transition out of them. This is the single source
 * of truth every write path (`reservation.service.ts`'s create/update/
 * status-change) and the UI (which action buttons/status options to render)
 * consult — see `getValidTransitionsFrom`.
 */
const TRANSITIONS: Record<
  ReservationStatusValue,
  readonly ReservationStatusValue[]
> = {
  inquiry: ["pending", "confirmed", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

export function isValidReservationStatusTransition(
  from: ReservationStatusValue,
  to: ReservationStatusValue,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The valid transition targets from a given status — e.g. for building a UI's status options. */
export function getValidTransitionsFrom(
  status: ReservationStatusValue,
): readonly ReservationStatusValue[] {
  return TRANSITIONS[status];
}

/**
 * The narrower subset of transitions an `employee` may apply directly
 * (operational check-in/check-out/no-show marking). Everything else —
 * confirming, cancelling, or any field other than status — is
 * owner/manager-only. Checked against `isValidReservationStatusTransition`
 * first, so this only ever narrows, never widens, the allowed set.
 */
const EMPLOYEE_TRANSITIONS = new Set([
  "confirmed->checked_in",
  "checked_in->checked_out",
  "confirmed->no_show",
]);

export function isEmployeeAllowedTransition(
  from: ReservationStatusValue,
  to: ReservationStatusValue,
): boolean {
  return EMPLOYEE_TRANSITIONS.has(`${from}->${to}`);
}

/** Cancelled and no-show reservations never block a unit's availability. */
export function isReservationBlockingStatus(
  status: ReservationStatusValue,
): boolean {
  return status !== "cancelled" && status !== "no_show";
}

/**
 * The statuses that never block a unit's availability, derived once from
 * `isReservationBlockingStatus` — the single source of truth for "which
 * statuses don't count" — rather than hand-maintaining the same literal list
 * in every query that needs it (`reservation.service.ts`'s overlap checks,
 * `rental-unit.service.ts`'s covering-reservation lookup for derived unit
 * status both consume this same constant).
 */
export const NON_BLOCKING_STATUSES = RESERVATION_STATUSES.filter(
  (status) => !isReservationBlockingStatus(status),
);

/**
 * Half-open interval overlap: `[aStart, aEnd)` vs `[bStart, bEnd)`. A stay
 * that checks out the day another checks in does **not** overlap — the unit
 * turns over same-day. Used both by the calendar's per-day occupancy check
 * (`reservation-calendar.tsx`) and its own unit tests; the database-level
 * guarantee (`reservations_no_overlap_excl` in drizzle/0011_reservations.sql)
 * and the service's `checkAvailability` pre-check necessarily re-express this
 * same rule in SQL rather than calling this JS function, since they run inside
 * the query planner, not in-process — but encode the identical formula.
 */
export function doDateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * List/detail/metrics scope for the current actor, keyed on the actor's own
 * `team_members.id` (not `users.id`) since `reservations.staffId` FKs to
 * `team_members`. `"none"` covers the (narrow, race-only) case where a
 * non-owner/manager actor has no resolvable active team-member row — callers
 * must treat it as "sees nothing" rather than querying with an empty
 * placeholder id, which would bind an empty string against a `uuid` column
 * and error at the database instead of returning a clean empty result.
 */
export type ReservationScope =
  | { kind: "all" }
  | { kind: "assigned"; teamMemberId: string }
  | { kind: "none" };

export function resolveReservationScope(
  role: string,
  actorTeamMemberId: string | null,
): ReservationScope {
  if (hasCapability({ role }, "reservations.assign")) return { kind: "all" };
  if (!actorTeamMemberId) return { kind: "none" };
  return { kind: "assigned", teamMemberId: actorTeamMemberId };
}

// ---------------------------------------------------------------------------
// Calendar month-grid range (shared by the server page's query bound and the
// client component's rendered grid, so the two can never drift apart)
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The padded, full-week grid range for a given `YYYY-MM` month: `start` is the
 * Sunday on/before the 1st, `end` is exclusive (the day after the Saturday
 * on/after the last day of the month). Used to bound the reservations query
 * to exactly what the calendar grid can render — never the whole table.
 */
export function computeMonthGridRange(monthISO: string): {
  start: string;
  end: string;
} {
  const [year, month] = monthISO.split("-").map(Number);
  const firstOfMonth = new Date(year!, month! - 1, 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());

  const lastOfMonth = new Date(year!, month!, 0);
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - lastOfMonth.getDay()) + 1);

  return { start: toISODate(gridStart), end: toISODate(gridEnd) };
}

// ---------------------------------------------------------------------------
// Workspace-timezone "today" (for arrivals/departures/upcoming metrics)
// ---------------------------------------------------------------------------

/** Maps this app's stored timezone values (see `settings`/`mock-data.ts`'s TIMEZONES) to real IANA identifiers. Falls back to UTC for any unrecognized value. */
const TIMEZONE_IANA: Record<string, string> = {
  "america-los_angeles": "America/Los_Angeles",
  "america-denver": "America/Denver",
  "america-chicago": "America/Chicago",
  "america-new_york": "America/New_York",
  "europe-london": "Europe/London",
  "europe-paris": "Europe/Paris",
};

/** Maps a stored workspace timezone value to a real IANA identifier (UTC fallback) — exported so a SQL query needing an `at time zone` cast (e.g. `housekeeping.service.ts`'s "completed today" filter) can use the identical mapping instead of re-deriving it. */
export function toIanaTimezone(timezone: string): string {
  return TIMEZONE_IANA[timezone] ?? "UTC";
}

/**
 * Today's calendar date (`YYYY-MM-DD`) as observed in the workspace's own
 * timezone, not the server's. A `check_in_date`/`check_out_date` is a plain
 * calendar date with no time-of-day, so "is this today" must be answered in
 * the business's local day, not an arbitrary server/UTC day that can already
 * be tomorrow (or still yesterday) relative to the workspace's actual clock.
 */
export function workspaceTodayDate(
  timezone: string,
  now: Date = new Date(),
): string {
  const iana = toIanaTimezone(timezone);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: iana,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  }
}
