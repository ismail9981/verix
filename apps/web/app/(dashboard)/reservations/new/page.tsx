import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthorizedWorkspace } from "../../../../src/server/auth/workspace";
import { db } from "../../../../src/server/db/db";
import {
  listCustomerOptions,
  listStaffOptions,
} from "../../../../src/server/services/reservation.service";
import { getWorkspaceCurrency, listRentalUnitOptions } from "../../../../src/server/services/rental-unit.service";
import { PageHeader } from "../../../../components/dashboard/ui/page-header";
import { NewReservationForm } from "../../../../components/dashboard/reservations/new-reservation-form";

export const metadata: Metadata = {
  title: "New reservation",
};

export const dynamic = "force-dynamic";

export default async function NewReservationPage() {
  const { workspaceId, role } = await getAuthorizedWorkspace();

  // Only owners/managers can create — matches the sprint's RBAC brief.
  if (role !== "owner" && role !== "manager") {
    redirect("/reservations");
  }

  const [unitOptions, customerOptions, staffOptions, defaultCurrency] = await Promise.all([
    listRentalUnitOptions(workspaceId),
    listCustomerOptions(workspaceId),
    listStaffOptions(workspaceId),
    getWorkspaceCurrency(db, workspaceId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New reservation" subtitle="Book a unit for a customer's stay." />
      <NewReservationForm
        unitOptions={unitOptions}
        customerOptions={customerOptions}
        staffOptions={staffOptions}
        defaultCurrency={defaultCurrency}
      />
    </div>
  );
}
