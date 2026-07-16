import type { Metadata } from "next";
import { getAuthorizedWorkspace } from "../../../src/server/auth/workspace";
import { db } from "../../../src/server/db/db";
import {
  getReservationMetrics,
  listCustomerOptions,
  listReservations,
  listStaffOptions,
} from "../../../src/server/services/reservation.service";
import { listRentalUnitOptions, listRentalUnits, getWorkspaceCurrency } from "../../../src/server/services/rental-unit.service";
import { reservationFiltersSchema } from "../../../src/server/validators/reservation";
import { ReservationsNavTabs } from "../../../components/dashboard/reservations/reservations-nav-tabs";
import { ReservationsManager } from "../../../components/dashboard/reservations/reservations-manager";

export const metadata: Metadata = {
  title: "Reservations",
};

// Reads live reservation data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; unit?: string; staff?: string }>;
}

export default async function ReservationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = reservationFiltersSchema.parse({
    search: params.q ?? "",
    status: params.status ?? "all",
    unitId: params.unit ?? "all",
    staffId: params.staff ?? "all",
  });

  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const actor = { userId, role };
  const canViewMetrics = role === "owner" || role === "manager";

  const [reservations, metrics, unitOptions, unitList, customerOptions, staffOptions, defaultCurrency] =
    await Promise.all([
      listReservations(workspaceId, actor, filters),
      canViewMetrics ? getReservationMetrics(workspaceId, actor) : Promise.resolve(null),
      listRentalUnitOptions(workspaceId),
      listRentalUnits(workspaceId),
      listCustomerOptions(workspaceId),
      listStaffOptions(workspaceId),
      getWorkspaceCurrency(db, workspaceId),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <ReservationsNavTabs />
      <ReservationsManager
        initialReservations={reservations}
        metrics={metrics}
        filters={filters}
        unitOptions={unitOptions}
        unitList={unitList}
        customerOptions={customerOptions}
        staffOptions={staffOptions}
        defaultCurrency={defaultCurrency}
        role={role}
      />
    </div>
  );
}
