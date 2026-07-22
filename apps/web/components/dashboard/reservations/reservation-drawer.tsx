"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer, DrawerField, DrawerSectionTitle } from "../detail-drawer";
import { StatusPill } from "./status-pills";
import {
  avatarColor,
  formatDate,
  formatMoney,
  initials,
  nightCount,
  statusLabel,
} from "./reservation-format";
import {
  RESERVATION_STATUSES,
  isEmployeeAllowedTransition,
  isValidReservationStatusTransition,
  type ReservationListItem,
  type ReservationStatusValue,
} from "../../../src/server/validators/reservation";

const TRANSITION_LABELS: Record<ReservationStatusValue, string> = {
  inquiry: "Move to inquiry",
  pending: "Move to pending",
  confirmed: "Confirm",
  checked_in: "Check in",
  checked_out: "Check out",
  cancelled: "Cancel",
  no_show: "Mark no-show",
};

interface ReservationDrawerProps {
  reservation: ReservationListItem | null;
  role: string;
  canEdit: boolean;
  pending: boolean;
  onClose: () => void;
  onEdit: (reservation: ReservationListItem) => void;
  onStatusChange: (reservation: ReservationListItem, next: ReservationStatusValue) => void;
  onCreateInvoice: (reservation: ReservationListItem) => void;
}

export function ReservationDrawer({
  reservation,
  role,
  canEdit,
  pending,
  onClose,
  onEdit,
  onStatusChange,
  onCreateInvoice,
}: ReservationDrawerProps) {
  const availableTransitions = reservation
    ? RESERVATION_STATUSES.filter((next) => {
        if (!isValidReservationStatusTransition(reservation.status, next)) return false;
        if (role === "owner" || role === "manager") return true;
        return isEmployeeAllowedTransition(reservation.status, next);
      })
    : [];

  return (
    <DetailDrawer
      open={reservation !== null}
      onClose={onClose}
      title="Reservation details"
      subtitle={reservation ? reservation.unitName : undefined}
      ariaLabel={reservation ? `Reservation for ${reservation.customerName}` : "Reservation details"}
    >
      {reservation ? (
        <div className="flex flex-col gap-6">
          <section aria-label="Customer" className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: avatarColor(reservation.customerId) }}
            >
              {initials(reservation.customerName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">{reservation.customerName}</p>
              <p className="text-xs text-muted">Customer</p>
            </div>
          </section>

          <section aria-label="Stay" className="flex flex-col gap-1">
            <DrawerSectionTitle>Stay</DrawerSectionTitle>
            <dl className="divide-y divide-hairline">
              <DrawerField label="Unit">{reservation.unitName}</DrawerField>
              <DrawerField label="Check-in">{formatDate(reservation.checkInDate)}</DrawerField>
              <DrawerField label="Check-out">{formatDate(reservation.checkOutDate)}</DrawerField>
              <DrawerField label="Nights">
                {nightCount(reservation.checkInDate, reservation.checkOutDate)}
              </DrawerField>
              <DrawerField label="Total">
                {formatMoney(reservation.priceCents, reservation.currency)}
              </DrawerField>
              <DrawerField label="Staff">{reservation.staffName ?? "Unassigned"}</DrawerField>
              <DrawerField label="Source">{reservation.source}</DrawerField>
              <DrawerField label="Status">
                <StatusPill status={statusLabel(reservation.status)} />
              </DrawerField>
            </dl>
          </section>

          <section aria-label="Notes" className="flex flex-col gap-2">
            <DrawerSectionTitle>Notes</DrawerSectionTitle>
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
              {reservation.notes?.trim() ? reservation.notes : "No notes yet."}
            </p>
          </section>

          {availableTransitions.length > 0 ? (
            <section aria-label="Status actions" className="flex flex-col gap-2">
              <DrawerSectionTitle>Update status</DrawerSectionTitle>
              <div className="flex flex-wrap gap-2">
                {availableTransitions.map((next) => (
                  <Button
                    key={next}
                    type="button"
                    size="sm"
                    className={CTA_SECONDARY}
                    loading={pending}
                    onClick={() => onStatusChange(reservation, next)}
                  >
                    {TRANSITION_LABELS[next]}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}

          {canEdit ? (
            <section aria-label="Billing" className="flex flex-col gap-2">
              <DrawerSectionTitle>Billing</DrawerSectionTitle>
              <Button
                type="button"
                size="sm"
                className={CTA_SECONDARY}
                loading={pending}
                onClick={() => onCreateInvoice(reservation)}
              >
                Create invoice
              </Button>
            </section>
          ) : null}

          {canEdit ? (
            <Button type="button" className={`${CTA_SECONDARY} w-full`} onClick={() => onEdit(reservation)}>
              Edit reservation
            </Button>
          ) : null}
        </div>
      ) : null}
    </DetailDrawer>
  );
}
