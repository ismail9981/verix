import Link from "next/link";
import { SectionCard } from "./section-card";
import { StatusPill } from "../reservations/status-pills";
import { formatDateShort, statusLabel } from "../reservations/reservation-format";
import type { ReservationTodayItem } from "../../../src/server/validators/dashboard-analytics";

const OPERATION_LABEL: Record<ReservationTodayItem["operation"], string> = {
  arrival: "Arriving today",
  departure: "Departing today",
  in_house: "In house",
};

export function TodaysReservationsCard({
  reservations,
}: {
  reservations: ReservationTodayItem[] | null;
}) {
  return (
    <SectionCard
      id="dashboard-todays-reservations"
      title="Today’s Reservations"
      bodyClassName="p-2"
      action={
        <Link href="/reservations" className="text-xs font-medium text-accent hover:text-accent-strong">
          View all
        </Link>
      }
    >
      {reservations === null ? (
        <p className="py-12 text-center text-sm text-muted">
          Today’s reservations are temporarily unavailable.
        </p>
      ) : reservations.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No arrivals, departures, or in-house stays today.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {reservations.map((reservation) => (
            <li key={reservation.id}>
              <Link
                href="/reservations"
                className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-canvas/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {reservation.customerName}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {reservation.propertyName} · {reservation.unitName}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {OPERATION_LABEL[reservation.operation]} · {formatDateShort(reservation.checkInDate)}–{formatDateShort(reservation.checkOutDate)}
                  </p>
                </div>
                <StatusPill status={statusLabel(reservation.status)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
