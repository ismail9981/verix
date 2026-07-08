import type { IconComponent } from "../types";

export interface Stat {
  id: string;
  label: string;
  value: string;
  /** Formatted delta, e.g. "+12.5%". */
  delta: string;
  trend: "up" | "down";
  /** Normalized points for the mini trend sparkline. */
  series: number[];
  icon: IconComponent;
}

export interface RevenuePoint {
  label: string;
  value: number;
}

export interface RevenueRange {
  key: string;
  label: string;
  total: string;
  points: RevenuePoint[];
}

export type AppointmentStatus = "Confirmed" | "Pending" | "Completed";

export interface Appointment {
  id: string;
  time: string;
  name: string;
  initials: string;
  service: string;
  status: AppointmentStatus;
  color: string;
}

export type ActivityType = "booking" | "payment" | "ai" | "crm";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  time: string;
}

export type InsightKind = "suggestion" | "marketing" | "alert";

export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  description: string;
}

export interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: IconComponent;
}
