import type { IconComponent } from "../types";

export type BookingStatus = "Confirmed" | "Pending" | "Completed" | "Cancelled";

export type PaymentStatus = "Paid" | "Unpaid" | "Refunded";

export interface BookingCustomer {
  name: string;
  email: string;
  phone: string;
  initials: string;
  color: string;
}

export interface BookingHistoryEntry {
  id: string;
  label: string;
  time: string;
}

export interface Booking {
  id: string;
  customer: BookingCustomer;
  service: string;
  staff: string;
  /** Display date, e.g. "Jul 8, 2026". */
  date: string;
  /** ISO date for filtering, e.g. "2026-07-08". */
  dateISO: string;
  time: string;
  status: BookingStatus;
  duration: string;
  price: string;
  payment: PaymentStatus;
  notes: string;
  history: BookingHistoryEntry[];
}

export interface BookingStat {
  id: string;
  label: string;
  value: string;
  icon: IconComponent;
}

export interface BookingFilters {
  search: string;
  status: string;
  service: string;
  staff: string;
  date: string;
}
