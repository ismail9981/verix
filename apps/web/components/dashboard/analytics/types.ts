export interface Kpi {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  series: number[];
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface RevenueRange {
  key: string;
  label: string;
  total: string;
  points: ChartPoint[];
}

export interface TrafficSource {
  label: string;
  value: number;
  color: string;
}

export interface TopService {
  rank: number;
  name: string;
  bookings: number;
  revenue: string;
  share: number;
}

export interface Report {
  id: string;
  name: string;
  range: string;
  date: string;
}

export interface AnalyticsFilters {
  range: string;
  service: string;
  staff: string;
}
