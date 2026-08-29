import type { Metadata } from "next";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";
import { getWorkspaceById } from "../../../src/server/services/workspace.service";
import {
  getPaymentStats,
  listBookingOptions,
  listPayments,
} from "../../../src/server/services/payment.service";
import {
  PAYMENT_CURRENCIES,
  paymentFiltersSchema,
} from "../../../src/server/validators/payment";
import { PaymentsManager } from "../../../components/dashboard/payments/payments-manager";

export const metadata: Metadata = {
  title: "Payments",
};

// Reads live payment data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; method?: string }>;
}

function resolveCurrency(workspaceCurrency: string): string {
  const upper = workspaceCurrency.toUpperCase();
  return (PAYMENT_CURRENCIES as readonly string[]).includes(upper)
    ? upper
    : "USD";
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = paymentFiltersSchema.parse({
    search: params.q ?? "",
    status: params.status ?? "all",
    method: params.method ?? "all",
  });

  const { workspaceId } = await requirePageCapability("payments.read");

  const [workspace, payments, stats, bookingOptions] = await Promise.all([
    getWorkspaceById(workspaceId),
    listPayments(workspaceId, filters),
    getPaymentStats(workspaceId),
    listBookingOptions(workspaceId),
  ]);

  return (
    <PaymentsManager
      initialPayments={payments}
      stats={stats}
      filters={filters}
      bookingOptions={bookingOptions}
      defaultCurrency={resolveCurrency(workspace?.currency ?? "USD")}
    />
  );
}
