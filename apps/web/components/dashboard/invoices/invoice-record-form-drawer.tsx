"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { FieldTextarea } from "../business-profile/field-textarea";
import { formatDate, formatMoney, methodLabel } from "./invoice-format";
import { PAYMENT_METHODS } from "../../../src/server/validators/payment";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { InvoiceRow } from "./types";

const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: methodLabel(method),
}));

interface InvoiceRecordFormDrawerProps {
  open: boolean;
  mode: "payment" | "refund";
  invoice: InvoiceRow | null;
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

export function InvoiceRecordFormDrawer({
  open,
  mode,
  invoice,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: InvoiceRecordFormDrawerProps) {
  // Generated once when this component mounts. The parent remounts it (via a
  // `key` keyed to mode+invoice) every time it's freshly opened, so this
  // stays stable across retries within one open session — safe, since
  // retrying the identical request under the same key is exactly what the
  // service's idempotency check is for — and is never reused across a
  // genuinely new request.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Refund choices are every non-voided charge on this invoice — no
  // remaining-refundable math here. `PaymentDto` doesn't expose that field,
  // and Sprint 17 Phase 2 deliberately leaves the cap to the service, which
  // rejects an over-limit pick with a user-safe error surfaced below.
  const chargeOptions =
    invoice?.payments.filter((payment) => payment.type === "charge" && !payment.voidedAt) ?? [];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  // `DetailDrawer`'s own close paths (backdrop click, header X, Escape) all
  // route through this — not just the Cancel button — so a submit in flight
  // can't be backed out of by any route while its result is still pending.
  function handleDrawerClose() {
    if (!pending) onClose();
  }

  const title = mode === "payment" ? "Record payment" : "Record refund";

  return (
    <DetailDrawer
      open={open}
      onClose={handleDrawerClose}
      title={title}
      subtitle={invoice?.number}
      ariaLabel={title}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <div className="flex flex-col gap-5">
          {invoice ? (
            <dl className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm">
              <div className="flex items-center justify-between py-1">
                {/* Refund mode shows net paid (already-exposed, not a
                    derived refund-eligibility figure) — Outstanding is the
                    unpaid balance and has no bearing on what's refundable. */}
                <dt className="text-muted">{mode === "refund" ? "Net paid" : "Outstanding"}</dt>
                <dd className="font-medium tabular-nums text-white">
                  {formatMoney(
                    mode === "refund" ? invoice.netPaidCents : invoice.outstandingCents,
                    invoice.currency,
                  )}
                </dd>
              </div>
            </dl>
          ) : null}

          {mode === "refund" ? (
            <div className="flex flex-col gap-1.5">
              <FieldSelect
                label="Charge to refund"
                name="chargePaymentId"
                options={[
                  { value: "", label: "Select a charge" },
                  ...chargeOptions.map((charge) => ({
                    value: charge.id,
                    label: `${formatMoney(charge.amountCents, charge.currency)} · ${formatDate(
                      charge.paidAt ?? charge.createdAt,
                    )}`,
                  })),
                ]}
                defaultValue=""
              />
              {fieldErrors.chargePaymentId?.[0] ? (
                <p className="text-xs text-red-400">{fieldErrors.chargePaymentId[0]}</p>
              ) : null}
            </div>
          ) : null}

          <FieldInput
            label="Amount"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
            error={fieldErrors.amount?.[0]}
          />

          {mode === "payment" ? (
            <div className="flex flex-col gap-1.5">
              <FieldSelect label="Method" name="method" options={METHOD_OPTIONS} defaultValue="card" />
              {fieldErrors.method?.[0] ? (
                <p className="text-xs text-red-400">{fieldErrors.method[0]}</p>
              ) : null}
            </div>
          ) : null}

          <FieldTextarea label="Notes (optional)" name="notes" rows={3} />
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} disabled={pending} onClick={handleDrawerClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {mode === "payment" ? "Record payment" : "Record refund"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
