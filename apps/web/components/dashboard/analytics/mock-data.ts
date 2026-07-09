import type { SelectOption } from "../business-profile/types";
import type {
  ChartPoint,
  Kpi,
  Report,
  RevenueRange,
  TopService,
  TrafficSource,
} from "./types";

/* All analytics content is mock (Bloom Studio, a salon). Kept here so a real
   analytics API can be dropped in without touching any component. */

export const KPIS: Kpi[] = [
  { id: "revenue", label: "Revenue", value: "$18,240", delta: "+12.5%", trend: "up", series: [8, 10, 9, 12, 11, 14, 16, 18] },
  { id: "bookings", label: "Bookings", value: "312", delta: "+8.1%", trend: "up", series: [6, 7, 7, 9, 8, 10, 11, 12] },
  { id: "conversion", label: "Conversion rate", value: "4.8%", delta: "+0.6pt", trend: "up", series: [3, 3.5, 3.4, 4, 4.2, 4.5, 4.6, 4.8] },
  { id: "growth", label: "Customer growth", value: "18.2%", delta: "-1.3pt", trend: "down", series: [22, 21, 20, 19.5, 19, 18.8, 18.5, 18.2] },
];

export const REVENUE_RANGES: RevenueRange[] = [
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
];

export const BOOKINGS_BY_SERVICE: ChartPoint[] = [
  { label: "Balayage & Cut", value: 86 },
  { label: "Gel Manicure", value: 72 },
  { label: "Beard Trim", value: 64 },
  { label: "Color & Cut", value: 48 },
  { label: "Blowout", value: 30 },
  { label: "Scalp Treatment", value: 18 },
];

export const CUSTOMER_GROWTH: ChartPoint[] = [
  { label: "Jan", value: 820 },
  { label: "Feb", value: 868 },
  { label: "Mar", value: 910 },
  { label: "Apr", value: 972 },
  { label: "May", value: 1024 },
  { label: "Jun", value: 1096 },
  { label: "Jul", value: 1204 },
];

export const TRAFFIC_SOURCES: TrafficSource[] = [
  { label: "Direct", value: 40, color: "#6d5ef9" },
  { label: "Search", value: 28, color: "#2dd4bf" },
  { label: "Social", value: 20, color: "#f59e0b" },
  { label: "Referral", value: 12, color: "#ec4899" },
];

export const TOP_SERVICES: TopService[] = [
  { rank: 1, name: "Balayage & Cut", bookings: 86, revenue: "$15,480", share: 100 },
  { rank: 2, name: "Color & Cut", bookings: 48, revenue: "$7,200", share: 65 },
  { rank: 3, name: "Gel Manicure", bookings: 72, revenue: "$3,240", share: 42 },
  { rank: 4, name: "Scalp Treatment", bookings: 18, revenue: "$1,620", share: 22 },
  { rank: 5, name: "Beard Trim", bookings: 64, revenue: "$2,240", share: 30 },
];

export const REPORTS: Report[] = [
  { id: "r1", name: "Monthly revenue summary", range: "Jun 2026", date: "Jul 1, 2026" },
  { id: "r2", name: "Staff performance report", range: "Q2 2026", date: "Jul 1, 2026" },
  { id: "r3", name: "Customer retention analysis", range: "Last 90 days", date: "Jun 28, 2026" },
  { id: "r4", name: "Service profitability", range: "Jun 2026", date: "Jun 30, 2026" },
];

const toOptions = (values: string[]): SelectOption[] =>
  values.map((value) => ({ value, label: value }));

export const RANGE_OPTIONS: SelectOption[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "12m", label: "Last 12 months" },
];

export const SERVICE_OPTIONS: SelectOption[] = [
  { value: "all", label: "All services" },
  ...toOptions([
    "Balayage & Cut",
    "Gel Manicure",
    "Beard Trim",
    "Color & Cut",
    "Blowout",
    "Scalp Treatment",
  ]),
];

export const STAFF_OPTIONS: SelectOption[] = [
  { value: "all", label: "All staff" },
  ...toOptions(["Ava Thompson", "Diego Martinez", "Mia Chen", "Noah Patel"]),
];
