import { CheckIcon, PaymentsIcon } from "../../landing/icons";
import { ClockIcon } from "../home/icons";
import type { SelectOption } from "../business-profile/types";
import type { StatItem } from "../ui/stat-grid";
import { AlertIcon } from "./icons";
import type { Payment } from "./types";

/* All payments content is mock (Bloom Studio, a salon). Kept here so a real
   payments API (Stripe/PayPal) can be dropped in without touching a component. */

export const STATS: StatItem[] = [
  { id: "revenue", label: "Total revenue", value: "$18,240", icon: PaymentsIcon },
  { id: "outstanding", label: "Outstanding", value: "$2,480", icon: ClockIcon },
  { id: "paid", label: "Paid", value: "286", icon: CheckIcon },
  { id: "failed", label: "Failed payments", value: "6", icon: AlertIcon },
];

export const REVENUE_SUMMARY = {
  monthly: "$18,240",
  pending: "$2,480",
  refunds: "$540",
};

export const PAYMENTS: Payment[] = [
  {
    id: "p1",
    invoice: "INV-1042",
    customer: { name: "Amelia Chen", email: "amelia.chen@email.com", initials: "AC", color: "#6d5ef9" },
    service: "Balayage & Cut",
    amount: "$180.00",
    method: "Visa",
    last4: "4242",
    status: "Paid",
    date: "Jul 8, 2026",
    dateDays: 0,
    billingAddress: ["120 Market St", "San Francisco, CA 94103", "United States"],
    notes: "Paid in full at checkout. Receipt emailed.",
    timeline: [
      { id: "t1", label: "Payment captured — $180.00", time: "Jul 8, 2026 · 11:32 AM" },
      { id: "t2", label: "Payment authorized", time: "Jul 8, 2026 · 11:32 AM" },
      { id: "t3", label: "Invoice created", time: "Jul 8, 2026 · 11:30 AM" },
    ],
  },
  {
    id: "p2",
    invoice: "INV-1041",
    customer: { name: "Marcus Reid", email: "marcus.reid@email.com", initials: "MR", color: "#2dd4bf" },
    service: "Beard Trim",
    amount: "$35.00",
    method: "Mastercard",
    last4: "8210",
    status: "Paid",
    date: "Jul 8, 2026",
    dateDays: 0,
    billingAddress: ["88 Chestnut St", "San Francisco, CA 94123", "United States"],
    notes: "Regular client. Card on file.",
    timeline: [
      { id: "t1", label: "Payment captured — $35.00", time: "Jul 8, 2026 · 10:48 AM" },
      { id: "t2", label: "Invoice created", time: "Jul 8, 2026 · 10:45 AM" },
    ],
  },
  {
    id: "p3",
    invoice: "INV-1040",
    customer: { name: "Sofia Marino", email: "sofia.marino@email.com", initials: "SM", color: "#f59e0b" },
    service: "Gel Manicure",
    amount: "$45.00",
    method: "PayPal",
    last4: "—",
    status: "Pending",
    date: "Jul 7, 2026",
    dateDays: 1,
    billingAddress: ["45 Union St", "San Francisco, CA 94133", "United States"],
    notes: "Awaiting PayPal confirmation.",
    timeline: [
      { id: "t1", label: "Awaiting payment confirmation", time: "Jul 7, 2026 · 6:41 PM" },
      { id: "t2", label: "Invoice sent", time: "Jul 7, 2026 · 6:40 PM" },
    ],
  },
  {
    id: "p4",
    invoice: "INV-1039",
    customer: { name: "Priya Anand", email: "priya.anand@email.com", initials: "PA", color: "#ec4899" },
    service: "Color & Cut",
    amount: "$150.00",
    method: "Visa",
    last4: "1881",
    status: "Paid",
    date: "Jul 6, 2026",
    dateDays: 2,
    billingAddress: ["9 Marina Blvd", "San Francisco, CA 94123", "United States"],
    notes: "Bridal package deposit applied.",
    timeline: [
      { id: "t1", label: "Payment captured — $150.00", time: "Jul 6, 2026 · 2:12 PM" },
      { id: "t2", label: "Invoice created", time: "Jul 6, 2026 · 2:00 PM" },
    ],
  },
  {
    id: "p5",
    invoice: "INV-1038",
    customer: { name: "Elena Novak", email: "elena.novak@email.com", initials: "EN", color: "#38bdf8" },
    service: "Blowout",
    amount: "$55.00",
    method: "Amex",
    last4: "3005",
    status: "Failed",
    date: "Jul 5, 2026",
    dateDays: 3,
    billingAddress: ["77 Pine St", "San Francisco, CA 94111", "United States"],
    notes: "Card declined — insufficient funds. Customer notified to retry.",
    timeline: [
      { id: "t1", label: "Payment failed — card declined", time: "Jul 5, 2026 · 4:22 PM" },
      { id: "t2", label: "Payment attempted", time: "Jul 5, 2026 · 4:22 PM" },
      { id: "t3", label: "Invoice created", time: "Jul 5, 2026 · 4:20 PM" },
    ],
  },
  {
    id: "p6",
    invoice: "INV-1035",
    customer: { name: "James Okafor", email: "james.okafor@email.com", initials: "JO", color: "#a78bfa" },
    service: "Scalp Treatment",
    amount: "$90.00",
    method: "Cash",
    last4: "—",
    status: "Paid",
    date: "Jul 4, 2026",
    dateDays: 4,
    billingAddress: ["210 Fillmore St", "San Francisco, CA 94117", "United States"],
    notes: "Paid in cash at the front desk.",
    timeline: [
      { id: "t1", label: "Payment recorded — $90.00 (cash)", time: "Jul 4, 2026 · 3:10 PM" },
      { id: "t2", label: "Invoice created", time: "Jul 4, 2026 · 3:05 PM" },
    ],
  },
  {
    id: "p7",
    invoice: "INV-1031",
    customer: { name: "Liam Foster", email: "liam.foster@email.com", initials: "LF", color: "#fb7185" },
    service: "Beard Trim",
    amount: "$35.00",
    method: "Visa",
    last4: "6027",
    status: "Refunded",
    date: "Jul 2, 2026",
    dateDays: 6,
    billingAddress: ["3 Dolores St", "San Francisco, CA 94103", "United States"],
    notes: "Appointment cancelled. Full refund issued to original card.",
    timeline: [
      { id: "t1", label: "Refund issued — $35.00", time: "Jul 2, 2026 · 7:45 PM" },
      { id: "t2", label: "Payment captured — $35.00", time: "Jun 30, 2026 · 1:00 PM" },
    ],
  },
  {
    id: "p8",
    invoice: "INV-1028",
    customer: { name: "Grace Kim", email: "grace.kim@email.com", initials: "GK", color: "#facc15" },
    service: "Gel Manicure",
    amount: "$45.00",
    method: "Mastercard",
    last4: "9931",
    status: "Paid",
    date: "Jun 28, 2026",
    dateDays: 10,
    billingAddress: ["500 Hayes St", "San Francisco, CA 94102", "United States"],
    notes: "Wedding prep booking.",
    timeline: [
      { id: "t1", label: "Payment captured — $45.00", time: "Jun 28, 2026 · 12:20 PM" },
      { id: "t2", label: "Invoice created", time: "Jun 28, 2026 · 12:00 PM" },
    ],
  },
  {
    id: "p9",
    invoice: "INV-1024",
    customer: { name: "Hannah Berg", email: "hannah.berg@email.com", initials: "HB", color: "#34d399" },
    service: "Balayage & Cut",
    amount: "$180.00",
    method: "PayPal",
    last4: "—",
    status: "Pending",
    date: "Jun 24, 2026",
    dateDays: 14,
    billingAddress: ["61 Divisadero St", "San Francisco, CA 94117", "United States"],
    notes: "Invoice sent, awaiting payment.",
    timeline: [
      { id: "t1", label: "Awaiting payment confirmation", time: "Jun 24, 2026 · 9:15 AM" },
      { id: "t2", label: "Invoice sent", time: "Jun 24, 2026 · 9:12 AM" },
    ],
  },
];

const toOptions = (values: string[]): SelectOption[] =>
  values.map((value) => ({ value, label: value }));

export const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All statuses" },
  ...toOptions(["Paid", "Pending", "Failed", "Refunded"]),
];

export const METHOD_OPTIONS: SelectOption[] = [
  { value: "all", label: "All methods" },
  ...toOptions(["Visa", "Mastercard", "Amex", "PayPal", "Cash"]),
];

export const DATE_OPTIONS: SelectOption[] = [
  { value: "all", label: "Any time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];
