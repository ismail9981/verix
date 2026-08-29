import type { Metadata } from "next";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";
import {
  getBookingStats,
  listBookings,
  listCustomerOptions,
  listServiceOptions,
} from "../../../src/server/services/booking.service";
import { bookingFiltersSchema } from "../../../src/server/validators/booking";
import { BookingsManager } from "../../../components/dashboard/bookings/bookings-manager";
import { hasCapability } from "../../../src/server/auth/capabilities";

export const metadata: Metadata = {
  title: "Bookings",
};

// Reads live booking data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; service?: string }>;
}

export default async function BookingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = bookingFiltersSchema.parse({
    search: params.q ?? "",
    status: params.status ?? "all",
    service: params.service ?? "all",
  });

  const workspace = await requirePageCapability("bookings.read");
  const { workspaceId } = workspace;
  const canManage = hasCapability(workspace, "bookings.manage");

  const [bookings, stats, customerOptions, serviceOptions] = await Promise.all([
    listBookings(workspaceId, workspace, filters),
    getBookingStats(workspaceId, workspace),
    canManage
      ? listCustomerOptions(workspaceId, workspace)
      : Promise.resolve([]),
    canManage
      ? listServiceOptions(workspaceId, workspace)
      : Promise.resolve([]),
  ]);

  return (
    <BookingsManager
      initialBookings={bookings}
      stats={stats}
      filters={filters}
      customerOptions={customerOptions}
      serviceOptions={serviceOptions}
      canManage={canManage}
    />
  );
}
