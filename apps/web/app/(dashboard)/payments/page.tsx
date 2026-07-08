import type { Metadata } from "next";
import { PagePlaceholder } from "../../../components/dashboard/page-placeholder";

export const metadata: Metadata = {
  title: "Payments",
};

export default function PaymentsPage() {
  return (
    <PagePlaceholder title="Payments" description="Accept payments and manage invoices." />
  );
}
