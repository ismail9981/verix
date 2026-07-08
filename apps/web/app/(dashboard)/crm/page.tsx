import type { Metadata } from "next";
import { PagePlaceholder } from "../../../components/dashboard/page-placeholder";

export const metadata: Metadata = {
  title: "CRM",
};

export default function CrmPage() {
  return (
    <PagePlaceholder title="CRM" description="Manage customer relationships." />
  );
}
