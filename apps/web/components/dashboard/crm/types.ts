import type { IconComponent } from "../types";

export type CustomerStatus = "Active" | "New" | "VIP" | "Inactive";

export interface CustomerBooking {
  id: string;
  service: string;
  date: string;
  price: string;
}

export interface UpcomingAppointment {
  service: string;
  date: string;
  time: string;
  staff: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  color: string;
  status: CustomerStatus;
  tags: string[];
  lastVisit: string;
  /** Days since last visit, for the "last visit" filter. */
  lastVisitDays: number;
  totalSpent: string;
  lifetimeValue: string;
  visits: number;
  since: string;
  notes: string;
  upcoming: UpcomingAppointment | null;
  history: CustomerBooking[];
}

export interface CrmStat {
  id: string;
  label: string;
  value: string;
  icon: IconComponent;
}

export interface CrmFilters {
  search: string;
  status: string;
  tag: string;
  lastVisit: string;
}
