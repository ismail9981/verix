"use client";

import { useMemo, useState } from "react";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { FieldTextarea } from "../business-profile/field-textarea";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import {
  INITIAL_RESERVATION_STATUSES,
  RESERVATION_SOURCES,
  getValidTransitionsFrom,
  type ReservationListItem,
  type ReservationPersonOption,
  type ReservationStatusValue,
} from "../../../src/server/validators/reservation";
import type { RentalUnitOption } from "../../../src/server/validators/rental-unit";

const SOURCE_OPTIONS = RESERVATION_SOURCES.map((s) => ({
  value: s,
  label: s === "walk_in" ? "Walk-in" : s.charAt(0).toUpperCase() + s.slice(1),
}));

const STATUS_LABELS: Record<ReservationStatusValue, string> = {
  inquiry: "Inquiry",
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const DATE_INPUT =
  "[&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert";

interface ReservationFormFieldsProps {
  reservation: ReservationListItem | null;
  unitOptions: RentalUnitOption[];
  customerOptions: ReservationPersonOption[];
  staffOptions: ReservationPersonOption[];
  defaultCurrency: string;
  fieldErrors: FieldErrors;
}

/* Shared field markup for both the create page (/reservations/new) and the
   edit form drawer, so the two never duplicate field JSX. Selecting a unit
   prefills the amount with that unit's default rate, for convenience only —
   the actual price is whatever's submitted. There is no Currency field:
   every reservation is priced in the workspace's own currency, resolved
   server-side (see validators/reservation.ts's note on reservationInputSchema). */
export function ReservationFormFields({
  reservation,
  unitOptions,
  customerOptions,
  staffOptions,
  defaultCurrency,
  fieldErrors,
}: ReservationFormFieldsProps) {
  const [unitId, setUnitId] = useState(reservation?.unitId ?? "");
  const [amount, setAmount] = useState(
    reservation ? String(reservation.priceCents / 100) : "",
  );

  function handleUnitChange(value: string) {
    setUnitId(value);
    if (!reservation) {
      const option = unitOptions.find((u) => u.id === value);
      if (option) setAmount(String(option.priceCents / 100));
    }
  }

  // Editing a reservation whose unit has since been deactivated must still
  // show that unit as the selected option (so the field isn't silently reset
  // to empty on save) — but never offer any *other* inactive unit as a new
  // choice. `unitOptions` is already active-only, so only the current
  // reservation's own unit needs to be appended when missing.
  const unitSelect = useMemo(() => {
    const options = [...unitOptions];
    if (reservation && !options.some((u) => u.id === reservation.unitId)) {
      options.push({
        id: reservation.unitId,
        name: `${reservation.unitName} (inactive)`,
        priceCents: reservation.priceCents,
        currency: reservation.currency,
      });
    }
    return [
      { value: "", label: "Select a unit" },
      ...options.map((u) => ({ value: u.id, label: u.name })),
    ];
  }, [unitOptions, reservation]);

  const customerSelect = [
    { value: "", label: "Select a customer" },
    ...customerOptions.map((c) => ({ value: c.id, label: c.name })),
  ];
  const staffSelect = [
    { value: "", label: "Unassigned" },
    ...staffOptions.map((s) => ({ value: s.id, label: s.name })),
  ];

  // Creating: only a valid starting status. Editing: the current status
  // (always a no-op option) plus whatever the state machine allows moving to
  // from here — never every status, so the UI can't offer an illegal or
  // terminal-resurrecting transition in the first place (the server
  // re-validates regardless). For a terminal reservation this collapses to a
  // single option (the current status) — deliberately NOT rendered with the
  // native `disabled` attribute below: a disabled field is excluded from
  // FormData entirely, and `status` arriving as `null` fails
  // reservationInputSchema's enum check (Zod's `.default()` only substitutes
  // for `undefined`, not `null`), making the whole form unsubmittable for any
  // other field too.
  const statusOptions = useMemo(() => {
    const allowed: readonly ReservationStatusValue[] = reservation
      ? [reservation.status, ...getValidTransitionsFrom(reservation.status)]
      : INITIAL_RESERVATION_STATUSES;
    return allowed.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
  }, [reservation]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <FieldSelect
          label="Unit"
          name="unitId"
          options={unitSelect}
          value={unitId}
          onChange={(event) => handleUnitChange(event.target.value)}
        />
        {fieldErrors.unitId?.[0] ? <p className="text-xs text-red-400">{fieldErrors.unitId[0]}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldSelect
          label="Customer"
          name="customerId"
          options={customerSelect}
          defaultValue={reservation?.customerId ?? ""}
        />
        {fieldErrors.customerId?.[0] ? <p className="text-xs text-red-400">{fieldErrors.customerId[0]}</p> : null}
      </div>

      <FieldSelect
        label="Assigned staff"
        name="staffId"
        options={staffSelect}
        defaultValue={reservation?.staffId ?? ""}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldInput
          label="Check-in"
          name="checkInDate"
          type="date"
          className={DATE_INPUT}
          required
          defaultValue={reservation?.checkInDate ?? ""}
          error={fieldErrors.checkInDate?.[0]}
        />
        <FieldInput
          label="Check-out"
          name="checkOutDate"
          type="date"
          className={DATE_INPUT}
          required
          defaultValue={reservation?.checkOutDate ?? ""}
          error={fieldErrors.checkOutDate?.[0]}
        />
      </div>

      <FieldInput
        label={`Amount (${(reservation?.currency ?? defaultCurrency).toUpperCase()})`}
        name="amount"
        type="number"
        min={0}
        step="0.01"
        required
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={fieldErrors.amount?.[0]}
        helperText="Priced in the workspace's currency, set in Settings."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldSelect
          label="Source"
          name="source"
          options={SOURCE_OPTIONS}
          defaultValue={reservation?.source ?? "direct"}
        />
        <FieldSelect
          label="Status"
          name="status"
          options={statusOptions}
          defaultValue={reservation?.status ?? "inquiry"}
        />
      </div>

      <FieldTextarea label="Notes" name="notes" rows={3} defaultValue={reservation?.notes ?? ""} />
    </div>
  );
}
