export type MemberRole = "Owner" | "Manager" | "Employee";

export type MemberStatus = "Active" | "Away" | "Offline";

export interface WeeklyDay {
  day: string;
  /** null means the member is off that day. */
  hours: string | null;
}

export interface MemberPerformance {
  bookings: number;
  revenue: string;
  rating: string;
}

export interface Member {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  initials: string;
  color: string;
  role: MemberRole;
  status: MemberStatus;
  /** Short schedule summary for the table. */
  schedule: string;
  services: string[];
  weekly: WeeklyDay[];
  performance: MemberPerformance;
  notes: string;
  activeToday: boolean;
}

export interface TeamFilters {
  search: string;
  role: string;
  status: string;
}
