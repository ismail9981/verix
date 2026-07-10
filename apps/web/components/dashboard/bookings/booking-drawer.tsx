"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import {
  DetailDrawer,
  DrawerField,
  DrawerSectionTitle,
} from "../detail-drawer";
import { StatusPill } from "./status-pills";
import {
  avatarColor,
  formatDate,
  formatDuration,
  formatTime,
  initials,
  statusLabel,
} from "./booking-format";
import type { BookingListItem } from "../../../src/server/validators/booking";

interface BookingDrawerProps {
  booking: BookingListItem | null;
  onClose: () => void;
  onEdit: (booking: BookingListItem) => void;
}

export function BookingDrawer({ booking, onClose, onEdit }: BookingDrawerProps) {
  return (
    <DetailDrawer
      open={booking !== null}
      onClose={onClose}
      title="Booking details"
      subtitle={booking ? formatDate(booking.startsAt) : undefined}
      ariaLabel={
        booking ? `Booking for ${booking.customerName}` : "Booking details"
      }
    >
      {booking ? (
        <div className="flex flex-col gap-6">
          {/* Customer */}
          <section aria-label="Customer" className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: avatarColor(booking.customerId) }}
            >
              {initials(booking.customerName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">
                {booking.customerName}
              </p>
              <p className="text-xs text-muted">Customer</p>
            </div>
          </section>

          {/* Appointment */}
          <section aria-label="Appointment" className="flex flex-col gap-1">
            <DrawerSectionTitle>Appointment</DrawerSectionTitle>
            <dl className="divide-y divide-hairline">
              <DrawerField label="Service">{booking.serviceName}</DrawerField>
              <DrawerField label="Date">
                {formatDate(booking.startsAt)}
              </DrawerField>
              <DrawerField label="Time">
                {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
              </DrawerField>
              <DrawerField label="Duration">
                {formatDuration(booking.startsAt, booking.endsAt)}
              </DrawerField>
              <DrawerField label="Status">
                <StatusPill status={statusLabel(booking.status)} />
              </DrawerField>
            </dl>
          </section>

          {/* Notes */}
          <section aria-label="Notes" className="flex flex-col gap-2">
            <DrawerSectionTitle>Notes</DrawerSectionTitle>
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
              {booking.notes?.trim() ? booking.notes : "No notes yet."}
            </p>
          </section>

          <Button
            type="button"
            className={`${CTA_SECONDARY} w-full`}
            onClick={() => onEdit(booking)}
          >
            Edit booking
          </Button>
        </div>
      ) : null}
    </DetailDrawer>
  );
}
