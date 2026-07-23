import { PageHeader } from "../ui/page-header";

/* No creation controls here by design — invoices are billed off a
   reservation elsewhere; this page only views, pays, refunds, and voids. */
export function InvoicesHeader() {
  return (
    <PageHeader
      title="Invoices"
      subtitle="View billed invoices, record payments and refunds, and track outstanding balances."
    />
  );
}
