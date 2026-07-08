"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CloseIcon } from "../icons";
import { ClockIcon, MailIcon, PhoneIcon } from "./icons";
import { PaymentPill, StatusPill } from "./status-pills";
import type { Booking } from "./types";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-white">{children}</dd>
    </div>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </h3>
  );
}

interface BookingDrawerProps {
  booking: Booking | null;
  onClose: () => void;
}

export function BookingDrawer({ booking, onClose }: BookingDrawerProps) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = booking !== null;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {booking ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Booking ${booking.id}`}
            initial={reduceMotion ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-hairline bg-canvas"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Booking details</h2>
                <p className="text-xs text-muted">{booking.id}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close booking details"
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="flex flex-col gap-6">
                {/* Customer */}
                <section aria-label="Customer information" className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: booking.customer.color }}
                    >
                      {booking.customer.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">
                        {booking.customer.name}
                      </p>
                      <p className="text-xs text-muted">Customer</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface/40 p-3">
                    <a
                      href={`mailto:${booking.customer.email}`}
                      className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <MailIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{booking.customer.email}</span>
                    </a>
                    <a
                      href={`tel:${booking.customer.phone}`}
                      className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <PhoneIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{booking.customer.phone}</span>
                    </a>
                  </div>
                </section>

                {/* Service */}
                <section aria-label="Service" className="flex flex-col gap-1">
                  <GroupTitle>Service</GroupTitle>
                  <dl className="divide-y divide-hairline">
                    <Field label="Service">{booking.service}</Field>
                    <Field label="Staff">{booking.staff}</Field>
                    <Field label="Date">{booking.date}</Field>
                    <Field label="Time">{booking.time}</Field>
                    <Field label="Duration">{booking.duration}</Field>
                    <Field label="Status">
                      <StatusPill status={booking.status} />
                    </Field>
                  </dl>
                </section>

                {/* Payment */}
                <section aria-label="Payment" className="flex flex-col gap-1">
                  <GroupTitle>Payment</GroupTitle>
                  <dl className="divide-y divide-hairline">
                    <Field label="Price">{booking.price}</Field>
                    <Field label="Payment status">
                      <PaymentPill status={booking.payment} />
                    </Field>
                  </dl>
                </section>

                {/* Notes */}
                <section aria-label="Notes" className="flex flex-col gap-2">
                  <GroupTitle>Notes</GroupTitle>
                  <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
                    {booking.notes}
                  </p>
                </section>

                {/* History */}
                <section aria-label="Booking history" className="flex flex-col gap-3">
                  <GroupTitle>Booking history</GroupTitle>
                  <ol className="flex flex-col gap-0">
                    {booking.history.map((entry, index) => {
                      const isLast = index === booking.history.length - 1;
                      return (
                        <li key={entry.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                              <ClockIcon className="h-3.5 w-3.5" />
                            </span>
                            {!isLast ? (
                              <span
                                aria-hidden="true"
                                className="my-1 w-px flex-1 bg-hairline"
                              />
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
              </div>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
