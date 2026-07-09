"use client";

import {
  DetailDrawer,
  DrawerField,
  DrawerSectionTitle,
} from "../detail-drawer";
import { MailIcon, PhoneIcon } from "../bookings/icons";
import { StatusPill, TagChip } from "./status-pill";
import type { Customer } from "./types";

interface CustomerDrawerProps {
  customer: Customer | null;
  onClose: () => void;
}

export function CustomerDrawer({ customer, onClose }: CustomerDrawerProps) {
  return (
    <DetailDrawer
      open={customer !== null}
      onClose={onClose}
      title="Customer profile"
      subtitle={customer?.id}
      ariaLabel={customer ? `Customer ${customer.name}` : "Customer profile"}
    >
      {customer ? (
        <div className="flex flex-col gap-6">
          {/* Profile */}
          <section aria-label="Profile" className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
              style={{ backgroundColor: customer.color }}
            >
              {customer.initials}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold text-white">
                  {customer.name}
                </p>
                <StatusPill status={customer.status} />
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Member since {customer.since} · {customer.visits} visits
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
              {customer.lifetimeValue}
            </p>
          </section>

          {/* Upcoming appointment */}
          <section aria-label="Upcoming appointment" className="flex flex-col gap-2">
            <DrawerSectionTitle>Upcoming appointment</DrawerSectionTitle>
            {customer.upcoming ? (
              <div className="rounded-xl border border-hairline bg-surface/40 p-4">
                <p className="text-sm font-medium text-white">
                  {customer.upcoming.service}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {customer.upcoming.date} · {customer.upcoming.time} ·{" "}
                  {customer.upcoming.staff}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-hairline p-4 text-sm text-muted">
                No upcoming appointment.
              </p>
            )}
          </section>

          {/* Contact information */}
          <section aria-label="Contact information" className="flex flex-col gap-2">
            <DrawerSectionTitle>Contact information</DrawerSectionTitle>
            <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface/40 p-3">
              <a
                href={`mailto:${customer.email}`}
                className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <MailIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{customer.email}</span>
              </a>
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <PhoneIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{customer.phone}</span>
              </a>
            </div>
            <dl className="divide-y divide-hairline">
              <DrawerField label="Total spent">{customer.totalSpent}</DrawerField>
              <DrawerField label="Last visit">{customer.lastVisit}</DrawerField>
            </dl>
          </section>

          {/* Tags */}
          <section aria-label="Tags" className="flex flex-col gap-2">
            <DrawerSectionTitle>Tags</DrawerSectionTitle>
            <ul className="flex flex-wrap gap-2">
              {customer.tags.map((tag) => (
                <li key={tag}>
                  <TagChip tag={tag} />
                </li>
              ))}
            </ul>
          </section>

          {/* Notes */}
          <section aria-label="Notes" className="flex flex-col gap-2">
            <DrawerSectionTitle>Notes</DrawerSectionTitle>
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
              {customer.notes}
            </p>
          </section>

          {/* Booking history */}
          <section aria-label="Booking history" className="flex flex-col gap-2">
            <DrawerSectionTitle>Booking history</DrawerSectionTitle>
            <ul className="divide-y divide-hairline">
              {customer.history.map((booking) => (
                <li
                  key={booking.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{booking.service}</p>
                    <p className="text-xs text-muted">{booking.date}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-white">
                    {booking.price}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </DetailDrawer>
  );
}
