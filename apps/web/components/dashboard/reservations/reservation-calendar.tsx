"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SectionCard } from "../home/section-card";
import { ChevronLeftIcon } from "./icons";
import { ChevronRightIcon } from "../icons";
import { StatusPill } from "./status-pills";
import { statusLabel } from "./reservation-format";
import { ReservationDrawer } from "./reservation-drawer";
import { updateReservationStatusAction } from "../../../src/server/actions/reservation";
import {
  computeMonthGridRange,
  doDateRangesOverlap,
  type ReservationListItem,
  type ReservationStatusValue,
} from "../../../src/server/validators/reservation";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

function nextDayISO(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

/** Every day in `[start, end)`, matching exactly the range the page fetched reservations for (`computeMonthGridRange`) so the grid and its data never drift apart. */
function enumerateGridDays(start: string, end: string): string[] {
  const days: string[] = [];
  for (let iso = start; iso < end; iso = nextDayISO(iso)) {
    days.push(iso);
  }
  return days;
}

interface ReservationCalendarProps {
  monthISO: string;
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  reservations: ReservationListItem[];
  role: string;
}

export function ReservationCalendar({
  monthISO,
  monthLabel,
  prevHref,
  nextHref,
  reservations,
  role,
}: ReservationCalendarProps) {
  const [selected, setSelected] = useState<ReservationListItem | null>(null);
  const [pending, setPending] = useState(false);

  const { start: gridStart, end: gridEnd } = useMemo(
    () => computeMonthGridRange(monthISO),
    [monthISO],
  );
  const days = useMemo(() => enumerateGridDays(gridStart, gridEnd), [gridStart, gridEnd]);
  const [year, month] = monthISO.split("-").map(Number);

  // The server already excludes cancelled/no-show reservations from what it
  // fetches (listReservationsInRange), so any reservation reaching this
  // component is safe to render as occupying its date range. Per-day
  // containment reuses the same half-open-interval predicate the overlap
  // check and its tests use, rather than a parallel ad hoc comparison.
  const byDay = useMemo(() => {
    const map = new Map<string, ReservationListItem[]>();
    for (const day of days) {
      const dayEnd = nextDayISO(day);
      const stays = reservations.filter((r) =>
        doDateRangesOverlap(r.checkInDate, r.checkOutDate, day, dayEnd),
      );
      map.set(day, stays);
    }
    return map;
  }, [days, reservations]);

  async function handleStatusChange(reservation: ReservationListItem, next: ReservationStatusValue) {
    setPending(true);
    await updateReservationStatusAction(reservation.id, next);
    setPending(false);
    setSelected(null);
  }

  return (
    <>
      <SectionCard
        id="reservations-calendar"
        title={monthLabel}
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-1">
            <Link
              href={prevHref}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-white"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Link>
            <Link
              href={nextHref}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-white"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-7 border-b border-hairline text-center text-xs font-medium text-muted">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-2 py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((iso) => {
            const stays = byDay.get(iso) ?? [];
            const day = parseISODate(iso);
            const inMonth = day.getMonth() === month! - 1 && day.getFullYear() === year;
            const isToday = iso === toISODate(new Date());
            return (
              <div
                key={iso}
                className={`min-h-[96px] border-b border-r border-hairline p-1.5 last:border-r-0 ${
                  inMonth ? "" : "opacity-40"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    isToday ? "bg-accent text-white" : "text-muted"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="mt-1 flex flex-col gap-1">
                  {stays.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelected(r)}
                      className="w-full truncate rounded bg-accent/25 px-1 py-0.5 text-left text-[11px] font-medium text-white hover:opacity-80"
                      title={`${r.customerName} · ${r.unitName}`}
                    >
                      {r.customerName}
                    </button>
                  ))}
                  {stays.length > 3 ? (
                    <span className="px-1 text-[10px] text-muted">+{stays.length - 3} more</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>Legend:</span>
        {(["inquiry", "pending", "confirmed", "checked_in", "checked_out"] as const).map((status) => (
          <StatusPill key={status} status={statusLabel(status)} />
        ))}
      </div>

      {/* Full-field editing happens on the list page; the calendar view only
          supports viewing details and quick status transitions. */}
      <ReservationDrawer
        reservation={selected}
        role={role}
        canEdit={false}
        pending={pending}
        onClose={() => setSelected(null)}
        onEdit={() => {}}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}
