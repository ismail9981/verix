import { StatGrid, type StatItem } from "../ui/stat-grid";
import type { ReservationMetrics } from "../../../src/server/validators/reservation";
import { formatMoney } from "./reservation-format";
import {
  ArrivalIcon,
  BedIcon,
  CalendarIcon,
  DepartureIcon,
  TrendingUpIcon,
} from "./icons";
import { CloseIcon } from "../icons";

export function ReservationStats({ metrics }: { metrics: ReservationMetrics }) {
  const stats: StatItem[] = [
    { id: "arrivals", label: "Arrivals today", value: String(metrics.arrivalsToday), icon: ArrivalIcon },
    { id: "departures", label: "Departures today", value: String(metrics.departuresToday), icon: DepartureIcon },
    { id: "active", label: "Active stays", value: String(metrics.activeStays), icon: BedIcon },
    { id: "upcoming", label: "Confirmed upcoming", value: String(metrics.confirmedUpcoming), icon: CalendarIcon },
    { id: "cancelled", label: "Cancelled", value: String(metrics.cancelledCount), icon: CloseIcon },
    { id: "revenue", label: "Revenue", value: formatMoney(metrics.revenueCents, metrics.currency), icon: TrendingUpIcon },
    { id: "occupancy", label: "Occupancy rate", value: `${metrics.occupancyRatePercent}%`, icon: BedIcon },
  ];

  return <StatGrid stats={stats} ariaLabel="Reservation statistics" />;
}
