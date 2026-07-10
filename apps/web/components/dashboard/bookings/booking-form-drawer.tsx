"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { FieldTextarea } from "../business-profile/field-textarea";
import { toDateTimeLocal } from "./booking-format";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  BookingListItem,
  BookingOption,
} from "../../../src/server/validators/booking";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const DATE_INPUT =
  "[&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert";

interface BookingFormDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  booking: BookingListItem | null;
  customerOptions: BookingOption[];
  serviceOptions: BookingOption[];
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

/* Create/edit form in the shared drawer. Customer & service selectors are
   populated from the real database. Uncontrolled (defaultValue), read via
   FormData; the parent remounts it with a `key` to reset between create/edit. */
export function BookingFormDrawer({
  open,
  mode,
  booking,
  customerOptions,
  serviceOptions,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: BookingFormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  const customerSelect = [
    { value: "", label: "Select a customer" },
    ...customerOptions.map((c) => ({ value: c.id, label: c.name })),
  ];
  const serviceSelect = [
    { value: "", label: "Select a service" },
    ...serviceOptions.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={mode === "create" ? "New booking" : "Edit booking"}
      subtitle="Schedule an appointment."
      ariaLabel={mode === "create" ? "New booking" : "Edit booking"}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <FieldSelect
              label="Customer"
              name="customerId"
              options={customerSelect}
              defaultValue={booking?.customerId ?? ""}
            />
            {fieldErrors.customerId?.[0] ? (
              <p className="text-xs text-red-400">{fieldErrors.customerId[0]}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldSelect
              label="Service"
              name="serviceId"
              options={serviceSelect}
              defaultValue={booking?.serviceId ?? ""}
            />
            {fieldErrors.serviceId?.[0] ? (
              <p className="text-xs text-red-400">{fieldErrors.serviceId[0]}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldInput
              label="Starts at"
              name="startsAt"
              type="datetime-local"
              className={DATE_INPUT}
              required
              defaultValue={booking ? toDateTimeLocal(booking.startsAt) : ""}
              error={fieldErrors.startsAt?.[0]}
            />
            <FieldInput
              label="Ends at"
              name="endsAt"
              type="datetime-local"
              className={DATE_INPUT}
              required
              defaultValue={booking ? toDateTimeLocal(booking.endsAt) : ""}
              error={fieldErrors.endsAt?.[0]}
            />
          </div>

          <FieldSelect
            label="Status"
            name="status"
            options={STATUS_OPTIONS}
            defaultValue={booking?.status ?? "confirmed"}
          />
          <FieldTextarea
            label="Notes"
            name="notes"
            rows={3}
            defaultValue={booking?.notes ?? ""}
          />
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {mode === "create" ? "Create booking" : "Save changes"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
