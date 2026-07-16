"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { PlusIcon } from "../icons";
import { CalendarIcon } from "./icons";
import { TableEmptyState, TableSkeleton } from "../ui/table-states";
import { ReservationActions } from "./reservation-actions";
import { StatusPill } from "./status-pills";
import { avatarColor, formatDateShort, formatMoney, initials, nightCount, statusLabel } from "./reservation-format";
import type { ReservationListItem } from "../../../src/server/validators/reservation";

interface ReservationTableProps {
  reservations: ReservationListItem[];
  loading: boolean;
  filtersActive: boolean;
  pending: boolean;
  canEdit: boolean;
  onView: (reservation: ReservationListItem) => void;
  onEdit: (reservation: ReservationListItem) => void;
  onDelete: (reservation: ReservationListItem) => void;
  onClearFilters: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function ReservationRow({
  reservation,
  canEdit,
  onView,
  onEdit,
  onDelete,
}: {
  reservation: ReservationListItem;
  canEdit: boolean;
  onView: (reservation: ReservationListItem) => void;
  onEdit: (reservation: ReservationListItem) => void;
  onDelete: (reservation: ReservationListItem) => void;
}) {
  return (
    <tr
      onClick={() => onView(reservation)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: avatarColor(reservation.customerId) }}
          >
            {initials(reservation.customerName)}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onView(reservation);
            }}
            className="truncate text-left text-sm font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {reservation.customerName}
          </button>
        </div>
      </td>
      <td className="hidden px-5 py-3 text-muted sm:table-cell">{reservation.unitName}</td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">
        {formatDateShort(reservation.checkInDate)} – {formatDateShort(reservation.checkOutDate)}
        <span className="ml-1.5 text-xs text-muted/70">
          ({nightCount(reservation.checkInDate, reservation.checkOutDate)}n)
        </span>
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted lg:table-cell">
        {formatMoney(reservation.priceCents, reservation.currency)}
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted xl:table-cell">
        {reservation.staffName ?? "—"}
      </td>
      <td className="px-5 py-3">
        <StatusPill status={statusLabel(reservation.status)} />
      </td>
      <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <ReservationActions
            canEdit={canEdit}
            onView={() => onView(reservation)}
            onEdit={() => onEdit(reservation)}
            onDelete={() => onDelete(reservation)}
          />
        </div>
      </td>
    </tr>
  );
}

export function ReservationTable({
  reservations,
  loading,
  filtersActive,
  pending,
  canEdit,
  onView,
  onEdit,
  onDelete,
  onClearFilters,
}: ReservationTableProps) {
  return (
    <SectionCard
      id="reservations"
      title="All reservations"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">
            {reservations.length} {reservations.length === 1 ? "result" : "results"}
          </span>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : reservations.length === 0 ? (
        filtersActive ? (
          <TableEmptyState
            icon={CalendarIcon}
            title="No reservations found"
            description="No reservations match your filters. Try adjusting or clearing them."
            onClear={onClearFilters}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
              <CalendarIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-white">No reservations yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Create your first reservation to start tracking stays.
            </p>
            {canEdit ? (
              <a href="/reservations/new">
                <Button type="button" size="sm" className={`${CTA_SECONDARY} mt-4`} leftIcon={<PlusIcon className="h-4 w-4" />}>
                  New reservation
                </Button>
              </a>
            ) : null}
          </div>
        )
      ) : (
        <div aria-busy={pending} className={`transition-opacity ${pending ? "opacity-60" : ""}`}>
          <table className="w-full text-sm">
            <caption className="sr-only">Reservations</caption>
            <thead>
              <tr className="border-y border-hairline text-left text-xs text-muted">
                <th scope="col" className={TH}>Customer</th>
                <th scope="col" className={`hidden sm:table-cell ${TH}`}>Unit</th>
                <th scope="col" className={`hidden md:table-cell ${TH}`}>Dates</th>
                <th scope="col" className={`hidden lg:table-cell ${TH}`}>Total</th>
                <th scope="col" className={`hidden xl:table-cell ${TH}`}>Staff</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <ReservationRow
                  key={reservation.id}
                  reservation={reservation}
                  canEdit={canEdit}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
