"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import {
  DetailDrawer,
  DrawerField,
  DrawerSectionTitle,
} from "../detail-drawer";
import { StatusPill } from "./status-pill";
import {
  avatarColor,
  formatDate,
  formatMoney,
  initials,
  methodLabel,
  paymentRef,
  statusLabel,
} from "./payment-format";
import type { PaymentListItem } from "../../../src/server/validators/payment";

interface PaymentDrawerProps {
  payment: PaymentListItem | null;
  onClose: () => void;
  onEdit: (payment: PaymentListItem) => void;
}

export function PaymentDrawer({ payment, onClose, onEdit }: PaymentDrawerProps) {
  return (
    <DetailDrawer
      open={payment !== null}
      onClose={onClose}
      title="Payment details"
      subtitle={payment ? paymentRef(payment.id) : undefined}
      ariaLabel={payment ? `Payment ${paymentRef(payment.id)}` : "Payment details"}
    >
      {payment ? (
        <div className="flex flex-col gap-6">
          {/* Payment information */}
          <section
            aria-label="Payment information"
            className="flex flex-col gap-1"
          >
            <DrawerSectionTitle>Payment information</DrawerSectionTitle>
            <dl className="divide-y divide-hairline">
              <DrawerField label="Reference">
                {paymentRef(payment.id)}
              </DrawerField>
              <DrawerField label="Service">
                {payment.serviceName ?? "—"}
              </DrawerField>
              <DrawerField label="Amount">
                {formatMoney(payment.amountCents, payment.currency)}
              </DrawerField>
              <DrawerField label="Method">
                {methodLabel(payment.method)}
              </DrawerField>
              <DrawerField label="Status">
                <StatusPill status={statusLabel(payment.status)} />
              </DrawerField>
              <DrawerField label="Date">
                {formatDate(payment.paidAt ?? payment.createdAt)}
              </DrawerField>
            </dl>
          </section>

          {/* Customer */}
          <section aria-label="Customer" className="flex flex-col gap-2">
            <DrawerSectionTitle>Customer</DrawerSectionTitle>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{
                  backgroundColor: avatarColor(payment.customerId ?? payment.id),
                }}
              >
                {initials(payment.customerName)}
              </span>
              <p className="truncate text-sm font-medium text-white">
                {payment.customerName}
              </p>
            </div>
          </section>

          {/* Notes */}
          <section aria-label="Notes" className="flex flex-col gap-2">
            <DrawerSectionTitle>Notes</DrawerSectionTitle>
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
              {payment.notes?.trim() ? payment.notes : "No notes yet."}
            </p>
          </section>

          <Button
            type="button"
            className={`${CTA_SECONDARY} w-full`}
            onClick={() => onEdit(payment)}
          >
            Edit payment
          </Button>
        </div>
      ) : null}
    </DetailDrawer>
  );
}
