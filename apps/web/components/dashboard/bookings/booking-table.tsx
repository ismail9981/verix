"use client";

import { SectionCard } from "../home/section-card";
import { BookingActions } from "./booking-actions";
import { BookingEmpty } from "./booking-empty";
import { TableSkeleton } from "../ui/table-states";
import { StatusPill } from "./status-pills";
import type { Booking } from "./types";

interface BookingTableProps {
  bookings: Booking[];
  loading: boolean;
  onSelect: (booking: Booking) => void;
  onClearFilters: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function BookingRow({
  booking,
  onSelect,
}: {
  booking: Booking;
  onSelect: (booking: Booking) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(booking)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: booking.customer.color }}
          >
            {booking.customer.initials}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(booking);
            }}
            className="truncate text-left text-sm font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {booking.customer.name}
          </button>
        </div>
      </td>
      <td className="hidden px-5 py-3 text-muted sm:table-cell">{booking.service}</td>
      <td className="hidden px-5 py-3 text-muted lg:table-cell">{booking.staff}</td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">
        {booking.date}
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted sm:table-cell">
        {booking.time}
      </td>
      <td className="px-5 py-3">
        <StatusPill status={booking.status} />
      </td>
      <td
        className="px-3 py-3 text-right"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <BookingActions onView={() => onSelect(booking)} />
        </div>
      </td>
    </tr>
  );
}

export function BookingTable({
  bookings,
  loading,
  onSelect,
  onClearFilters,
}: BookingTableProps) {
  return (
    <SectionCard
      id="bookings"
      title="All bookings"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">{bookings.length} results</span>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : bookings.length === 0 ? (
        <BookingEmpty onClear={onClearFilters} />
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Bookings</caption>
          <thead>
            <tr className="border-y border-hairline text-left text-xs text-muted">
              <th scope="col" className={TH}>Customer</th>
              <th scope="col" className={`hidden sm:table-cell ${TH}`}>Service</th>
              <th scope="col" className={`hidden lg:table-cell ${TH}`}>Staff</th>
              <th scope="col" className={`hidden md:table-cell ${TH}`}>Date</th>
              <th scope="col" className={`hidden sm:table-cell ${TH}`}>Time</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <BookingRow key={booking.id} booking={booking} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
