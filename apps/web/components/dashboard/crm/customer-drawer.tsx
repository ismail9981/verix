"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import {
  DetailDrawer,
  DrawerField,
  DrawerSectionTitle,
} from "../detail-drawer";
import { MailIcon, PhoneIcon } from "../bookings/icons";
import { StatusPill } from "./status-pill";
import {
  avatarColor,
  formatDate,
  formatMoney,
  initials,
  statusLabel,
} from "./customer-format";
import type { CustomerListItem } from "../../../src/server/validators/customer";

interface CustomerDrawerProps {
  customer: CustomerListItem | null;
  onClose: () => void;
  onEdit: (customer: CustomerListItem) => void;
}

export function CustomerDrawer({ customer, onClose, onEdit }: CustomerDrawerProps) {
  return (
    <DetailDrawer
      open={customer !== null}
      onClose={onClose}
      title="Customer profile"
      subtitle={customer ? `Added ${formatDate(customer.createdAt)}` : undefined}
      ariaLabel={customer ? `Customer ${customer.name}` : "Customer profile"}
    >
      {customer ? (
        <div className="flex flex-col gap-6">
          {/* Profile */}
          <section aria-label="Profile" className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
              style={{ backgroundColor: avatarColor(customer.id) }}
            >
              {initials(customer.name)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold text-white">
                  {customer.name}
                </p>
                <StatusPill status={statusLabel(customer.status)} />
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Customer since {formatDate(customer.createdAt)}
              </p>
            </div>
          </section>

          {/* Lifetime value */}
          <section
            aria-label="Lifetime value"
            className="rounded-xl border border-hairline bg-surface/40 p-4"
          >
            <p className="text-xs text-muted">Lifetime value</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-white">
              {formatMoney(customer.totalSpentCents)}
            </p>
          </section>

          {/* Contact information */}
          <section aria-label="Contact information" className="flex flex-col gap-2">
            <DrawerSectionTitle>Contact information</DrawerSectionTitle>
            <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface/40 p-3">
              <div className="flex items-center gap-2 text-sm text-muted">
                <MailIcon className="h-4 w-4 shrink-0" />
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    className="truncate transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {customer.email}
                  </a>
                ) : (
                  <span className="truncate">No email</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <PhoneIcon className="h-4 w-4 shrink-0" />
                {customer.phone ? (
                  <a
                    href={`tel:${customer.phone}`}
                    className="truncate transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {customer.phone}
                  </a>
                ) : (
                  <span className="truncate">No phone</span>
                )}
              </div>
            </div>
            <dl className="divide-y divide-hairline">
              <DrawerField label="Total spent">
                {formatMoney(customer.totalSpentCents)}
              </DrawerField>
              <DrawerField label="Status">
                {statusLabel(customer.status)}
              </DrawerField>
            </dl>
          </section>

          {/* Notes */}
          <section aria-label="Notes" className="flex flex-col gap-2">
            <DrawerSectionTitle>Notes</DrawerSectionTitle>
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
              {customer.notes?.trim() ? customer.notes : "No notes yet."}
            </p>
          </section>

          <Button
            type="button"
            className={`${CTA_SECONDARY} w-full`}
            onClick={() => onEdit(customer)}
          >
            Edit customer
          </Button>
        </div>
      ) : null}
    </DetailDrawer>
  );
}
