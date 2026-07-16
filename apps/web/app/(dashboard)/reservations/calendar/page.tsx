import type { Metadata } from "next";
import { getAuthorizedWorkspace } from "../../../../src/server/auth/workspace";
import { listReservationsInRange } from "../../../../src/server/services/reservation.service";
import { computeMonthGridRange } from "../../../../src/server/validators/reservation";
import { ReservationsNavTabs } from "../../../../components/dashboard/reservations/reservations-nav-tabs";
import { ReservationCalendar } from "../../../../components/dashboard/reservations/reservation-calendar";

export const metadata: Metadata = {
  title: "Reservations · Calendar",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

function currentMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthISO: string, delta: number): string {
  const [year, month] = monthISO.split("-").map(Number);
  const date = new Date(year!, month! - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthISO: string): string {
  const [year, month] = monthISO.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year!, month! - 1, 1),
  );
}

export default async function ReservationsCalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const monthISO = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : currentMonthISO();

  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const { start, end } = computeMonthGridRange(monthISO);
  const reservations = await listReservationsInRange(workspaceId, { userId, role }, start, end);

  return (
    <div className="flex flex-col gap-6">
      <ReservationsNavTabs />
      <ReservationCalendar
        monthISO={monthISO}
        monthLabel={monthLabel(monthISO)}
        prevHref={`/reservations/calendar?month=${shiftMonth(monthISO, -1)}`}
        nextHref={`/reservations/calendar?month=${shiftMonth(monthISO, 1)}`}
        reservations={reservations}
        role={role}
      />
    </div>
  );
}
