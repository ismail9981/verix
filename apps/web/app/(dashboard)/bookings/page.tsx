import type { Metadata } from "next";
import { getAuthorizedWorkspace } from "../../../src/server/auth/workspace";
import {
  getBookingStats,
  listBookings,
  listCustomerOptions,
  listServiceOptions,
} from "../../../src/server/services/booking.service";
import { bookingFiltersSchema } from "../../../src/server/validators/booking";
import { BookingsManager } from "../../../components/dashboard/bookings/bookings-manager";

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

  const { workspaceId } = await getAuthorizedWorkspace();

  const [bookings, stats, customerOptions, serviceOptions] = await Promise.all([
    listBookings(workspaceId, filters),
    getBookingStats(workspaceId),
    listCustomerOptions(workspaceId),
    listServiceOptions(workspaceId),
  ]);

  return (
    <BookingsManager
      initialBookings={bookings}
      stats={stats}
      filters={filters}
      customerOptions={customerOptions}
      serviceOptions={serviceOptions}
    />
  );
}
