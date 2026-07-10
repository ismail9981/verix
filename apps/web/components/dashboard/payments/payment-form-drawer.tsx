"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { FieldTextarea } from "../business-profile/field-textarea";
import { formatMoney, toDateTimeLocal } from "./payment-format";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  PaymentBookingOption,
  PaymentListItem,
} from "../../../src/server/validators/payment";

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "AUD", "CAD"].map((c) => ({
  value: c,
  label: c,
}));

const METHOD_OPTIONS = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "bank_transfer", label: "Bank transfer" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const DATE_INPUT =
  "[&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert";

interface PaymentFormDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  payment: PaymentListItem | null;
  bookingOptions: PaymentBookingOption[];
  defaultCurrency: string;
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

export function PaymentFormDrawer({
  open,
  mode,
  payment,
  bookingOptions,
  defaultCurrency,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: PaymentFormDrawerProps) {
  const [bookingId, setBookingId] = useState(payment?.bookingId ?? "");
  const [amount, setAmount] = useState(
    payment ? String(payment.amountCents / 100) : "",
  );

  const selected = bookingOptions.find((b) => b.id === bookingId) ?? null;

  function handleBookingChange(value: string) {
    setBookingId(value);
    // On create, prefill the amount with the booking's total for convenience.
    if (mode === "create") {
      const option = bookingOptions.find((b) => b.id === value);
      if (option) setAmount(String(option.priceCents / 100));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  const bookingSelect = [
    { value: "", label: "Select a booking" },
    ...bookingOptions.map((b) => ({
      value: b.id,
      label: `${b.customerName} · ${b.serviceName}`,
    })),
  ];

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Record payment" : "Edit payment"}
      subtitle="Payment against a booking."
      ariaLabel={mode === "create" ? "Record payment" : "Edit payment"}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <FieldSelect
              label="Booking"
              name="bookingId"
              options={bookingSelect}
              value={bookingId}
              onChange={(event) => handleBookingChange(event.target.value)}
            />
            {fieldErrors.bookingId?.[0] ? (
              <p className="text-xs text-red-400">{fieldErrors.bookingId[0]}</p>
            ) : null}
          </div>

          {/* Details revealed when a booking is selected. */}
          {selected ? (
            <dl className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm">
              <div className="flex items-center justify-between py-1">
                <dt className="text-muted">Customer</dt>
                <dd className="font-medium text-white">
                  {selected.customerName}
                </dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-muted">Service</dt>
                <dd className="font-medium text-white">
                  {selected.serviceName}
                </dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-muted">Booking total</dt>
                <dd className="font-medium tabular-nums text-white">
                  {formatMoney(selected.priceCents)}
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldInput
              label="Amount"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              error={fieldErrors.amount?.[0]}
            />
            <FieldSelect
              label="Currency"
              name="currency"
              options={CURRENCY_OPTIONS}
              defaultValue={payment?.currency ?? defaultCurrency}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldSelect
              label="Method"
              name="method"
              options={METHOD_OPTIONS}
              defaultValue={payment?.method ?? "card"}
            />
            <FieldSelect
              label="Status"
              name="status"
              options={STATUS_OPTIONS}
              defaultValue={payment?.status ?? "paid"}
            />
          </div>

          <FieldInput
            label="Paid at (optional)"
            name="paidAt"
            type="datetime-local"
            className={DATE_INPUT}
            defaultValue={payment?.paidAt ? toDateTimeLocal(payment.paidAt) : ""}
          />
          <FieldTextarea
            label="Notes"
            name="notes"
            rows={3}
            defaultValue={payment?.notes ?? ""}
          />
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {mode === "create" ? "Record payment" : "Save changes"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
