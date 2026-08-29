import type { Metadata } from "next";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";
import {
  getInvoice,
  listInvoicePayments,
  listInvoices,
} from "../../../src/server/services/invoice.service";
import { InvoicesManager } from "../../../components/dashboard/invoices/invoices-manager";
import type { InvoiceRow } from "../../../components/dashboard/invoices/types";

export const metadata: Metadata = {
  title: "Invoices",
};

// Reads live billing data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { workspaceId, userId, role } =
    await requirePageCapability("invoices.read");
  const actor = { userId, role };

  const invoiceList = await listInvoices(workspaceId, actor);

  // Preloads every invoice's full detail + payment history up front, in the
  // Server Component, so the view drawer is populated entirely from props —
  // there are no read Server Actions in this feature, and `router.refresh()`
  // is what keeps this fresh after a mutation. Uses only the existing
  // per-id `getInvoice`/`listInvoicePayments` APIs, unchanged; no new
  // batching helper.
  const invoices: InvoiceRow[] = await Promise.all(
    invoiceList.map(async (item) => {
      const [detail, payments] = await Promise.all([
        getInvoice(workspaceId, item.id, actor),
        listInvoicePayments(workspaceId, item.id, actor),
      ]);
      return { ...detail, payments };
    }),
  );

  return <InvoicesManager initialInvoices={invoices} role={role} />;
}
