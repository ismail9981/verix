import { CheckIcon } from "../../landing/icons";
import type { SelectOption } from "../business-profile/types";
import { CloseIcon } from "../icons";
import { CalendarIcon, ClockIcon } from "./icons";
import type { Booking, BookingStat } from "./types";

/* All booking data is mock (Bloom Studio, a salon). Kept in this file so a
   real API response can be dropped in without touching any component. */

export const SERVICES = [
  "Balayage & Cut",
  "Beard Trim",
  "Gel Manicure",
  "Blowout",
  "Color & Cut",
  "Scalp Treatment",
];

export const STAFF = ["Ava Thompson", "Diego Martinez", "Mia Chen", "Noah Patel"];

export const BOOKINGS: Booking[] = [
  {
    id: "BK-1042",
    customer: { name: "Amelia Chen", email: "amelia.chen@email.com", phone: "+1 (415) 555-0111", initials: "AC", color: "#6d5ef9" },
    service: "Balayage & Cut",
    staff: "Ava Thompson",
    date: "Jul 8, 2026",
    dateISO: "2026-07-08",
    time: "9:00 AM",
    status: "Confirmed",
    duration: "2h 30m",
    price: "$180",
    payment: "Paid",
    notes: "Prefers a warm balayage tone. Allergic to ammonia-based products.",
    history: [
      { id: "h1", label: "Booking confirmed", time: "Jul 2, 2026 · 3:12 PM" },
      { id: "h2", label: "Payment received — $180", time: "Jul 2, 2026 · 3:12 PM" },
      { id: "h3", label: "Booking created", time: "Jul 2, 2026 · 3:10 PM" },
    ],
  },
  {
    id: "BK-1043",
    customer: { name: "Marcus Reid", email: "marcus.reid@email.com", phone: "+1 (415) 555-0132", initials: "MR", color: "#2dd4bf" },
    service: "Beard Trim",
    staff: "Diego Martinez",
    date: "Jul 8, 2026",
    dateISO: "2026-07-08",
    time: "10:15 AM",
    status: "Confirmed",
    duration: "30m",
    price: "$35",
    payment: "Paid",
    notes: "Regular client — usual style.",
    history: [
      { id: "h1", label: "Booking confirmed", time: "Jul 5, 2026 · 9:01 AM" },
      { id: "h2", label: "Booking created", time: "Jul 5, 2026 · 9:00 AM" },
    ],
  },
  {
    id: "BK-1044",
    customer: { name: "Sofia Marino", email: "sofia.marino@email.com", phone: "+1 (415) 555-0148", initials: "SM", color: "#f59e0b" },
    service: "Gel Manicure",
    staff: "Mia Chen",
    date: "Jul 8, 2026",
    dateISO: "2026-07-08",
    time: "11:00 AM",
    status: "Pending",
    duration: "45m",
    price: "$45",
    payment: "Unpaid",
    notes: "First-time visit. Wants a French gel set.",
    history: [{ id: "h1", label: "Booking created — awaiting confirmation", time: "Jul 7, 2026 · 6:40 PM" }],
  },
  {
    id: "BK-1045",
    customer: { name: "Priya Anand", email: "priya.anand@email.com", phone: "+1 (415) 555-0170", initials: "PA", color: "#ec4899" },
    service: "Color & Cut",
    staff: "Ava Thompson",
    date: "Jul 9, 2026",
    dateISO: "2026-07-09",
    time: "1:30 PM",
    status: "Confirmed",
    duration: "2h",
    price: "$150",
    payment: "Paid",
    notes: "Going one shade darker than last visit.",
    history: [
      { id: "h1", label: "Booking confirmed", time: "Jul 6, 2026 · 11:20 AM" },
      { id: "h2", label: "Payment received — $150", time: "Jul 6, 2026 · 11:20 AM" },
    ],
  },
  {
    id: "BK-1046",
    customer: { name: "Elena Novak", email: "elena.novak@email.com", phone: "+1 (415) 555-0199", initials: "EN", color: "#38bdf8" },
    service: "Blowout",
    staff: "Noah Patel",
    date: "Jul 9, 2026",
    dateISO: "2026-07-09",
    time: "3:00 PM",
    status: "Pending",
    duration: "45m",
    price: "$55",
    payment: "Unpaid",
    notes: "Event styling — needs to be done by 4 PM.",
    history: [{ id: "h1", label: "Booking created — awaiting confirmation", time: "Jul 7, 2026 · 8:15 PM" }],
  },
  {
    id: "BK-1039",
    customer: { name: "James Okafor", email: "james.okafor@email.com", phone: "+1 (415) 555-0123", initials: "JO", color: "#a78bfa" },
    service: "Scalp Treatment",
    staff: "Mia Chen",
    date: "Jul 7, 2026",
    dateISO: "2026-07-07",
    time: "2:00 PM",
    status: "Completed",
    duration: "1h",
    price: "$90",
    payment: "Paid",
    notes: "Follow-up treatment recommended in 4 weeks.",
    history: [
      { id: "h1", label: "Appointment completed", time: "Jul 7, 2026 · 3:02 PM" },
      { id: "h2", label: "Payment received — $90", time: "Jul 7, 2026 · 3:05 PM" },
      { id: "h3", label: "Booking confirmed", time: "Jul 1, 2026 · 10:00 AM" },
    ],
  },
  {
    id: "BK-1038",
    customer: { name: "Hannah Berg", email: "hannah.berg@email.com", phone: "+1 (415) 555-0155", initials: "HB", color: "#34d399" },
    service: "Balayage & Cut",
    staff: "Ava Thompson",
    date: "Jul 6, 2026",
    dateISO: "2026-07-06",
    time: "10:00 AM",
    status: "Completed",
    duration: "2h 30m",
    price: "$180",
    payment: "Paid",
    notes: "Loved the result — rebooked for next month.",
    history: [
      { id: "h1", label: "Appointment completed", time: "Jul 6, 2026 · 12:28 PM" },
      { id: "h2", label: "Payment received — $180", time: "Jul 6, 2026 · 12:30 PM" },
    ],
  },
  {
    id: "BK-1035",
    customer: { name: "Liam Foster", email: "liam.foster@email.com", phone: "+1 (415) 555-0161", initials: "LF", color: "#fb7185" },
    service: "Beard Trim",
    staff: "Diego Martinez",
    date: "Jul 5, 2026",
    dateISO: "2026-07-05",
    time: "4:30 PM",
    status: "Cancelled",
    duration: "30m",
    price: "$35",
    payment: "Refunded",
    notes: "Cancelled due to scheduling conflict. Refund issued.",
    history: [
      { id: "h1", label: "Booking cancelled — refund issued", time: "Jul 4, 2026 · 7:45 PM" },
      { id: "h2", label: "Booking confirmed", time: "Jul 2, 2026 · 1:00 PM" },
    ],
  },
  {
    id: "BK-1047",
    customer: { name: "Grace Kim", email: "grace.kim@email.com", phone: "+1 (415) 555-0184", initials: "GK", color: "#facc15" },
    service: "Gel Manicure",
    staff: "Mia Chen",
    date: "Jul 10, 2026",
    dateISO: "2026-07-10",
    time: "12:00 PM",
    status: "Confirmed",
    duration: "45m",
    price: "$45",
    payment: "Paid",
    notes: "Wants a bold red for a wedding.",
    history: [
      { id: "h1", label: "Booking confirmed", time: "Jul 7, 2026 · 2:30 PM" },
      { id: "h2", label: "Payment received — $45", time: "Jul 7, 2026 · 2:30 PM" },
    ],
  },
];

export const STATS: BookingStat[] = [
  { id: "today", label: "Today's bookings", value: "8", icon: CalendarIcon },
  { id: "upcoming", label: "Upcoming", value: "24", icon: ClockIcon },
  { id: "completed", label: "Completed", value: "132", icon: CheckIcon },
  { id: "cancelled", label: "Cancelled", value: "6", icon: CloseIcon },
];

const toOptions = (values: string[]): SelectOption[] =>
  values.map((value) => ({ value, label: value }));

export const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All statuses" },
  ...toOptions(["Confirmed", "Pending", "Completed", "Cancelled"]),
];

export const SERVICE_OPTIONS: SelectOption[] = [
  { value: "all", label: "All services" },
  ...toOptions(SERVICES),
];

export const STAFF_OPTIONS: SelectOption[] = [
  { value: "all", label: "All staff" },
  ...toOptions(STAFF),
];
