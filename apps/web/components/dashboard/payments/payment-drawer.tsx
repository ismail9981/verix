"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { MailIcon } from "../bookings/icons";
import {
  DetailDrawer,
  DrawerField,
  DrawerSectionTitle,
} from "../detail-drawer";
import { DownloadIcon } from "../analytics/icons";
import { RefundIcon } from "./icons";
import { StatusPill } from "./status-pill";
import type { Payment } from "./types";

interface PaymentDrawerProps {
  payment: Payment | null;
  onClose: () => void;
}

export function PaymentDrawer({ payment, onClose }: PaymentDrawerProps) {
  return (
    <DetailDrawer
      open={payment !== null}
      onClose={onClose}
      title="Payment details"
      subtitle={payment?.invoice}
      ariaLabel={payment ? `Payment ${payment.invoice}` : "Payment details"}
    >
      {payment ? (
        <div className="flex flex-col gap-6">
          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              className={CTA_SECONDARY}
              leftIcon={<DownloadIcon className="h-4 w-4" />}
            >
              Download
            </Button>
            <Button
              type="button"
              className={CTA_SECONDARY}
              leftIcon={<RefundIcon className="h-4 w-4" />}
            >
              Refund
            </Button>
          </div>

          {/* Invoice information */}
          <section aria-label="Invoice information" className="flex flex-col gap-1">
            <DrawerSectionTitle>Invoice information</DrawerSectionTitle>
            <dl className="divide-y divide-hairline">
              <DrawerField label="Invoice">{payment.invoice}</DrawerField>
              <DrawerField label="Service">{payment.service}</DrawerField>
              <DrawerField label="Amount">{payment.amount}</DrawerField>
              <DrawerField label="Method">
                {payment.method}
                {payment.last4 !== "—" ? ` •••• ${payment.last4}` : ""}
              </DrawerField>
              <DrawerField label="Status">
                <StatusPill status={payment.status} />
              </DrawerField>
              <DrawerField label="Date">{payment.date}</DrawerField>
            </dl>
          </section>

          {/* Customer */}
          <section aria-label="Customer" className="flex flex-col gap-2">
            <DrawerSectionTitle>Customer</DrawerSectionTitle>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: payment.customer.color }}
              >
                {payment.customer.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {payment.customer.name}
                </p>
                <a
                  href={`mailto:${payment.customer.email}`}
                  className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <MailIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{payment.customer.email}</span>
                </a>
              </div>
            </div>
          </section>

          {/* Payment timeline */}
          <section aria-label="Payment timeline" className="flex flex-col gap-3">
            <DrawerSectionTitle>Payment timeline</DrawerSectionTitle>
            <ol className="flex flex-col gap-0">
              {payment.timeline.map((entry, index) => {
                const isLast = index === payment.timeline.length - 1;
                return (
                  <li key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                      {!isLast ? (
                        <span aria-hidden="true" className="my-1 w-px flex-1 bg-hairline" />
                      ) : null}
                    </div>
                    <div className={isLast ? "pb-0" : "pb-4"}>
                      <p className="text-sm text-white">{entry.label}</p>
                      <p className="mt-0.5 text-xs text-muted">{entry.time}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Billing address */}
          <section aria-label="Billing address" className="flex flex-col gap-2">
            <DrawerSectionTitle>Billing address</DrawerSectionTitle>
            <address className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm not-italic leading-relaxed text-muted">
              {payment.billingAddress.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </section>

          {/* Notes */}
          <section aria-label="Notes" className="flex flex-col gap-2">
            <DrawerSectionTitle>Notes</DrawerSectionTitle>
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
              {payment.notes}
            </p>
          </section>
        </div>
      ) : null}
    </DetailDrawer>
  );
}
