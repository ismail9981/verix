export type PaymentStatus = "Paid" | "Pending" | "Failed" | "Refunded";

export type PaymentMethod = "Visa" | "Mastercard" | "Amex" | "PayPal" | "Cash";

export interface PaymentCustomer {
  name: string;
  email: string;
  initials: string;
  color: string;
}

export interface TimelineEntry {
  id: string;
  label: string;
  time: string;
}

export interface Payment {
  id: string;
  invoice: string;
  customer: PaymentCustomer;
  service: string;
  amount: string;
  method: PaymentMethod;
  last4: string;
  status: PaymentStatus;
  date: string;
  /** Days since the payment, for the date-range filter. */
  dateDays: number;
  billingAddress: string[];
  notes: string;
  timeline: TimelineEntry[];
}

export interface PaymentFilters {
  search: string;
  status: string;
  method: string;
  date: string;
}
