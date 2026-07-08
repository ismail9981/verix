import {
  AiIcon,
  AnalyticsIcon,
  BookingIcon,
  CrmIcon,
  PaymentsIcon,
  WebsiteIcon,
} from "../../landing/icons";
import { TeamIcon } from "../icons";
import { ClockIcon, UserPlusIcon } from "./icons";
import type {
  ActivityItem,
  Appointment,
  Insight,
  QuickAction,
  RevenueRange,
  Stat,
} from "./types";

/* All content on the dashboard is mock data (Bloom Studio, a salon). It is
   colocated here so real API responses can be swapped in later without
   touching any component. */

export const BUSINESS_NAME = "Bloom Studio";
export const USER_FIRST_NAME = "Jordan";

export const STATS: Stat[] = [
  {
    id: "revenue",
    label: "Revenue",
    value: "$18,240",
    delta: "+12.5%",
    trend: "up",
    series: [8, 10, 9, 12, 11, 14, 13, 16, 18],
    icon: PaymentsIcon,
  },
  {
    id: "bookings",
    label: "Bookings",
    value: "312",
    delta: "+8.1%",
    trend: "up",
    series: [6, 7, 7, 9, 8, 10, 11, 10, 12],
    icon: BookingIcon,
  },
  {
    id: "customers",
    label: "Customers",
    value: "1,204",
    delta: "+5.2%",
    trend: "up",
    series: [5, 6, 6, 7, 8, 8, 9, 10, 11],
    icon: TeamIcon,
  },
  {
    id: "appointments",
    label: "Appointments today",
    value: "24",
    delta: "+3",
    trend: "up",
    series: [4, 5, 3, 6, 5, 7, 6, 8, 7],
    icon: ClockIcon,
  },
  {
    id: "growth",
    label: "Growth",
    value: "18.2%",
    delta: "+2.4%",
    trend: "up",
    series: [3, 4, 5, 5, 6, 7, 8, 9, 11],
    icon: AnalyticsIcon,
  },
];

export const REVENUE_RANGES: RevenueRange[] = [
  {
    key: "12m",
    label: "12 months",
    total: "$182,400",
    points: [
      { label: "Jan", value: 9200 },
      { label: "Feb", value: 10400 },
      { label: "Mar", value: 9800 },
      { label: "Apr", value: 12600 },
      { label: "May", value: 11800 },
      { label: "Jun", value: 14200 },
      { label: "Jul", value: 18240 },
      { label: "Aug", value: 16800 },
      { label: "Sep", value: 15400 },
      { label: "Oct", value: 17200 },
      { label: "Nov", value: 19600 },
      { label: "Dec", value: 21400 },
    ],
  },
  {
    key: "30d",
    label: "30 days",
    total: "$18,240",
    points: [
      { label: "W1", value: 3800 },
      { label: "W2", value: 4600 },
      { label: "W3", value: 4200 },
      { label: "W4", value: 5640 },
    ],
  },
  {
    key: "7d",
    label: "7 days",
    total: "$4,320",
    points: [
      { label: "Mon", value: 520 },
      { label: "Tue", value: 410 },
      { label: "Wed", value: 680 },
      { label: "Thu", value: 590 },
      { label: "Fri", value: 940 },
      { label: "Sat", value: 820 },
      { label: "Sun", value: 360 },
    ],
  },
];

export const APPOINTMENTS: Appointment[] = [
  { id: "1", time: "09:00", name: "Amelia Chen", initials: "AC", service: "Balayage & cut", status: "Confirmed", color: "#6d5ef9" },
  { id: "2", time: "10:15", name: "Marcus Reid", initials: "MR", service: "Beard trim", status: "Confirmed", color: "#2dd4bf" },
  { id: "3", time: "11:00", name: "Sofia Marino", initials: "SM", service: "Gel manicure", status: "Pending", color: "#f59e0b" },
  { id: "4", time: "13:30", name: "Priya Anand", initials: "PA", service: "Color & cut", status: "Confirmed", color: "#ec4899" },
  { id: "5", time: "15:00", name: "Elena Novak", initials: "EN", service: "Blowout", status: "Completed", color: "#38bdf8" },
];

export const ACTIVITY: ActivityItem[] = [
  { id: "1", type: "payment", title: "Payment received", description: "$240 from Marcus Reid", time: "5m ago" },
  { id: "2", type: "booking", title: "New booking", description: "Amelia Chen — Balayage, Fri 9:30", time: "22m ago" },
  { id: "3", type: "ai", title: "AI summary ready", description: "Your weekly business insights are in", time: "1h ago" },
  { id: "4", type: "crm", title: "New customer", description: "Priya Anand was added to your CRM", time: "3h ago" },
  { id: "5", type: "payment", title: "Invoice paid", description: "$540 invoice from Lumen Clinic", time: "Yesterday" },
];

export const INSIGHTS: Insight[] = [
  {
    id: "1",
    kind: "suggestion",
    title: "Fill your Tuesday gaps",
    description: "Tuesdays run 30% below capacity. A midweek promo could recover ~$1,200/month.",
  },
  {
    id: "2",
    kind: "marketing",
    title: "Launch a summer color campaign",
    description: "Color services trend up in July. Email 480 lapsed clients with a seasonal offer.",
  },
  {
    id: "3",
    kind: "alert",
    title: "3 appointments unconfirmed",
    description: "Three clients haven't confirmed tomorrow. Send a reminder to cut no-shows.",
  },
];

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Create booking", description: "Schedule a new appointment", href: "/bookings", icon: BookingIcon },
  { label: "Add customer", description: "Add a profile to your CRM", href: "/crm", icon: UserPlusIcon },
  { label: "Generate website", description: "Build a page with AI", href: "/website-builder", icon: WebsiteIcon },
  { label: "Open CRM", description: "View customer relationships", href: "/crm", icon: CrmIcon },
];

/** Icon + accent color per activity type, used by the timeline. */
export const ACTIVITY_STYLES: Record<
  ActivityItem["type"],
  { icon: typeof BookingIcon; className: string }
> = {
  booking: { icon: BookingIcon, className: "bg-accent/10 text-accent" },
  payment: { icon: PaymentsIcon, className: "bg-emerald-500/10 text-emerald-400" },
  ai: { icon: AiIcon, className: "bg-violet-500/10 text-violet-400" },
  crm: { icon: CrmIcon, className: "bg-sky-500/10 text-sky-400" },
};
