"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { PlusIcon } from "../icons";
import { CalendarIcon } from "./icons";
import { TableEmptyState, TableSkeleton } from "../ui/table-states";
import { BookingActions } from "./booking-actions";
import { StatusPill } from "./status-pills";
import {
  avatarColor,
  formatDate,
  formatTime,
  initials,
  statusLabel,
} from "./booking-format";
import type { BookingListItem } from "../../../src/server/validators/booking";

interface BookingTableProps {
  bookings: BookingListItem[];
  loading: boolean;
  filtersActive: boolean;
  pending: boolean;
  onView: (booking: BookingListItem) => void;
  onEdit: (booking: BookingListItem) => void;
  onDelete: (booking: BookingListItem) => void;
  onClearFilters: () => void;
  onAdd: () => void;
  canManage: boolean;
}

const TH = "px-5 py-2.5 font-medium";

function BookingRow({
  booking,
  onView,
  onEdit,
  onDelete,
  canManage,
}: {
  booking: BookingListItem;
  onView: (booking: BookingListItem) => void;
  onEdit: (booking: BookingListItem) => void;
  onDelete: (booking: BookingListItem) => void;
  canManage: boolean;
}) {
  return (
    <tr
      onClick={() => onView(booking)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: avatarColor(booking.customerId) }}
          >
            {initials(booking.customerName)}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onView(booking);
            }}
            className="truncate text-left text-sm font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {booking.customerName}
          </button>
        </div>
      </td>
      <td className="hidden px-5 py-3 text-muted sm:table-cell">
        {booking.serviceName}
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">
        {formatDate(booking.startsAt)}
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted lg:table-cell">
        {formatTime(booking.startsAt)}
      </td>
      <td className="px-5 py-3">
        <StatusPill status={statusLabel(booking.status)} />
      </td>
      <td
        className="px-3 py-3 text-right"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <BookingActions
            onView={() => onView(booking)}
            onEdit={() => onEdit(booking)}
            onDelete={() => onDelete(booking)}
            canManage={canManage}
          />
        </div>
      </td>
    </tr>
  );
}

export function BookingTable({
  bookings,
  loading,
  filtersActive,
  pending,
  onView,
  onEdit,
  onDelete,
  onClearFilters,
  onAdd,
  canManage,
}: BookingTableProps) {
  return (
    <SectionCard
      id="bookings"
      title="All bookings"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">
            {bookings.length} {bookings.length === 1 ? "result" : "results"}
          </span>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : bookings.length === 0 ? (
        filtersActive ? (
          <TableEmptyState
            icon={CalendarIcon}
            title="No bookings found"
            description="No bookings match your filters. Try adjusting or clearing them."
            onClear={onClearFilters}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
              <CalendarIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-white">
              No bookings yet
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Create your first booking to start scheduling appointments.
            </p>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                className={`${CTA_SECONDARY} mt-4`}
                leftIcon={<PlusIcon className="h-4 w-4" />}
                onClick={onAdd}
              >
                New booking
              </Button>
            ) : null}
          </div>
        )
      ) : (
        <div
          aria-busy={pending}
          className={`transition-opacity ${pending ? "opacity-60" : ""}`}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">Bookings</caption>
            <thead>
              <tr className="border-y border-hairline text-left text-xs text-muted">
                <th scope="col" className={TH}>
                  Customer
                </th>
                <th scope="col" className={`hidden sm:table-cell ${TH}`}>
                  Service
                </th>
                <th scope="col" className={`hidden md:table-cell ${TH}`}>
                  Date
                </th>
                <th scope="col" className={`hidden lg:table-cell ${TH}`}>
                  Time
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  canManage={canManage}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
