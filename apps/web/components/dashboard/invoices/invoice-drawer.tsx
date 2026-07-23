"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import {
  DetailDrawer,
  DrawerField,
  DrawerSectionTitle,
} from "../detail-drawer";
import { StatusPill } from "./status-pill";
import {
  formatDate,
  formatMoney,
  lineItemTypeLabel,
  methodLabel,
  statusLabel,
} from "./invoice-format";
import type { InvoiceRow } from "./types";
import { REASON_MAX, type PaymentDto } from "../../../src/server/validators/invoice";

/** A void-reason field error, scoped to the one payment row it applies to — `voidPaymentAction` is per-payment, so this must never render on the wrong row. */
export interface VoidFieldError {
  paymentId: string;
  message: string;
}

interface InvoiceDrawerProps {
  invoice: InvoiceRow | null;
  canManage: boolean;
  pending: boolean;
  voidFieldError: VoidFieldError | null;
  onClose: () => void;
  onRecordPayment: (invoice: InvoiceRow) => void;
  onRecordRefund: (invoice: InvoiceRow) => void;
  onVoidPayment: (invoice: InvoiceRow, paymentId: string, reason: string) => void;
  onClearVoidFieldError: () => void;
}

function PaymentHistoryRow({
  payment,
  currency,
  canVoid,
  pending,
  error,
  onVoid,
  onClearError,
}: {
  payment: PaymentDto;
  currency: string;
  canVoid: boolean;
  pending: boolean;
  error?: string;
  onVoid: (paymentId: string, reason: string) => void;
  onClearError: () => void;
}) {
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">
            {payment.type === "refund" ? "Refund" : "Charge"} ·{" "}
            {formatMoney(payment.amountCents, currency)}
          </p>
          <p className="text-xs text-muted">
            {methodLabel(payment.method)} · {formatDate(payment.paidAt ?? payment.createdAt)}
          </p>
        </div>
        {payment.voidedAt ? (
          <span className="shrink-0 text-xs font-medium text-red-400">Voided</span>
        ) : canVoid ? (
          <Button
            type="button"
            size="sm"
            className={CTA_SECONDARY}
            onClick={() => {
              onClearError();
              setVoiding((prev) => !prev);
            }}
          >
            Void
          </Button>
        ) : null}
      </div>
      {payment.notes?.trim() ? (
        <p className="text-xs leading-relaxed text-muted">{payment.notes}</p>
      ) : null}
      {voiding ? (
        <div className="flex flex-col gap-2 border-t border-hairline pt-2">
          <label
            className="text-xs font-medium text-muted"
            htmlFor={`void-reason-${payment.id}`}
          >
            Reason for voiding
          </label>
          <textarea
            id={`void-reason-${payment.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={REASON_MAX}
            className="w-full rounded-lg border border-hairline bg-canvas p-2 text-xs text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          />
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              className={CTA_SECONDARY}
              disabled={pending}
              onClick={() => {
                onClearError();
                setVoiding(false);
                setReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              loading={pending}
              disabled={reason.trim() === ""}
              onClick={() => onVoid(payment.id, reason.trim())}
            >
              Confirm void
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function InvoiceDrawer({
  invoice,
  canManage,
  pending,
  voidFieldError,
  onClose,
  onRecordPayment,
  onRecordRefund,
  onVoidPayment,
  onClearVoidFieldError,
}: InvoiceDrawerProps) {
  // Deliberate UI-only gate on the invoice's own already-exposed `status`
  // field, not a new domain rule: `recordPayment`/`recordRefund` already
  // reject anything but an open/paid invoice, so hiding the buttons
  // elsewhere just avoids an inevitable error round-trip.
  const payable = invoice?.status === "open" || invoice?.status === "paid";

  // `DetailDrawer`'s own close paths (backdrop click, header X, Escape) all
  // route through this — not just a void's Cancel button — so a void in
  // flight can't be backed out of by any route while its result is pending.
  function handleDrawerClose() {
    if (!pending) onClose();
  }

  return (
    <DetailDrawer
      open={invoice !== null}
      onClose={handleDrawerClose}
      title="Invoice details"
      subtitle={invoice?.number}
      ariaLabel={invoice ? `Invoice ${invoice.number}` : "Invoice details"}
      size="lg"
    >
      {invoice ? (
        <div className="flex flex-col gap-6">
          <section aria-label="Invoice information" className="flex flex-col gap-1">
            <DrawerSectionTitle>Invoice information</DrawerSectionTitle>
            <dl className="divide-y divide-hairline">
              <DrawerField label="Number">{invoice.number}</DrawerField>
              <DrawerField label="Customer">
                {invoice.customerName ?? invoice.customerNameSnapshot ?? "—"}
              </DrawerField>
              <DrawerField label="Status">
                <StatusPill status={statusLabel(invoice.status)} />
              </DrawerField>
              <DrawerField label="Total">
                {formatMoney(invoice.amountCents, invoice.currency)}
              </DrawerField>
              <DrawerField label="Net paid">
                {formatMoney(invoice.netPaidCents, invoice.currency)}
              </DrawerField>
              <DrawerField label="Outstanding">
                {formatMoney(invoice.outstandingCents, invoice.currency)}
              </DrawerField>
              <DrawerField label="Issued">{formatDate(invoice.issuedAt)}</DrawerField>
              <DrawerField label="Due">{formatDate(invoice.dueAt)}</DrawerField>
            </dl>
          </section>

          {invoice.propertyNameSnapshot ||
          invoice.unitNameSnapshot ||
          invoice.checkInDateSnapshot ? (
            <section aria-label="Stay" className="flex flex-col gap-1">
              <DrawerSectionTitle>Stay</DrawerSectionTitle>
              <dl className="divide-y divide-hairline">
                <DrawerField label="Property">
                  {invoice.propertyNameSnapshot ?? "—"}
                </DrawerField>
                <DrawerField label="Building">
                  {invoice.buildingNameSnapshot ?? "—"}
                </DrawerField>
                <DrawerField label="Unit">{invoice.unitNameSnapshot ?? "—"}</DrawerField>
                <DrawerField label="Check-in">
                  {formatDate(invoice.checkInDateSnapshot)}
                </DrawerField>
                <DrawerField label="Check-out">
                  {formatDate(invoice.checkOutDateSnapshot)}
                </DrawerField>
              </dl>
            </section>
          ) : null}

          <section aria-label="Line items" className="flex flex-col gap-2">
            <DrawerSectionTitle>Line items</DrawerSectionTitle>
            {invoice.lineItems.length === 0 ? (
              <p className="text-sm text-muted">No line items.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {invoice.lineItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface/40 p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{item.description}</p>
                      <p className="text-xs text-muted">
                        {lineItemTypeLabel(item.type)} · Qty {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 font-medium tabular-nums text-white">
                      {formatMoney(item.amountCents, invoice.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Notes" className="flex flex-col gap-2">
            <DrawerSectionTitle>Notes</DrawerSectionTitle>
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
              {invoice.notes?.trim() ? invoice.notes : "No notes yet."}
            </p>
          </section>

          <section aria-label="Payment history" className="flex flex-col gap-2">
            <DrawerSectionTitle>Payment history</DrawerSectionTitle>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {invoice.payments.map((payment) => (
                  <PaymentHistoryRow
                    key={payment.id}
                    payment={payment}
                    currency={invoice.currency}
                    canVoid={canManage}
                    pending={pending}
                    error={voidFieldError?.paymentId === payment.id ? voidFieldError.message : undefined}
                    onVoid={(paymentId, reason) => onVoidPayment(invoice, paymentId, reason)}
                    onClearError={onClearVoidFieldError}
                  />
                ))}
              </ul>
            )}
          </section>

          {canManage && payable ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className={`${CTA_PRIMARY} flex-1`}
                onClick={() => onRecordPayment(invoice)}
              >
                Record payment
              </Button>
              <Button
                type="button"
                className={`${CTA_SECONDARY} flex-1`}
                onClick={() => onRecordRefund(invoice)}
              >
                Record refund
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </DetailDrawer>
  );
}
