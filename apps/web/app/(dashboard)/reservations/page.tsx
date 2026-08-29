import type { Metadata } from "next";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";
import { hasCapability } from "../../../src/server/auth/capabilities";
import { db } from "../../../src/server/db/db";
import {
  getReservationMetrics,
  listCustomerOptions,
  listReservations,
  listStaffOptions,
} from "../../../src/server/services/reservation.service";
import {
  listRentalUnitOptions,
  getWorkspaceCurrency,
} from "../../../src/server/services/rental-unit.service";
import { reservationFiltersSchema } from "../../../src/server/validators/reservation";
import { ReservationsNavTabs } from "../../../components/dashboard/reservations/reservations-nav-tabs";
import { ReservationsManager } from "../../../components/dashboard/reservations/reservations-manager";

export const metadata: Metadata = {
  title: "Reservations",
};

// Reads live reservation data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    unit?: string;
    staff?: string;
  }>;
}

export default async function ReservationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = reservationFiltersSchema.parse({
    search: params.q ?? "",
    status: params.status ?? "all",
    unitId: params.unit ?? "all",
    staffId: params.staff ?? "all",
  });

  const workspace = await requirePageCapability("reservations.read");
  const { workspaceId, userId, role } = workspace;
  const actor = { userId, role };
  const canManage = hasCapability(workspace, "reservations.assign");

  const [
    reservations,
    metrics,
    unitOptions,
    customerOptions,
    staffOptions,
    defaultCurrency,
  ] = await Promise.all([
    listReservations(workspaceId, actor, filters),
    canManage
      ? getReservationMetrics(workspaceId, actor)
      : Promise.resolve(null),
    canManage ? listRentalUnitOptions(workspaceId) : Promise.resolve([]),
    canManage ? listCustomerOptions(workspaceId) : Promise.resolve([]),
    canManage ? listStaffOptions(workspaceId) : Promise.resolve([]),
    canManage ? getWorkspaceCurrency(db, workspaceId) : Promise.resolve("USD"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <ReservationsNavTabs />
      <ReservationsManager
        initialReservations={reservations}
        metrics={metrics}
        filters={filters}
        unitOptions={unitOptions}
        customerOptions={customerOptions}
        staffOptions={staffOptions}
        defaultCurrency={defaultCurrency}
        role={role}
      />
    </div>
  );
}
