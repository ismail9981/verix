import type { Metadata } from "next";
import { CrmView } from "../../../components/dashboard/crm/crm-view";

export const metadata: Metadata = {
  title: "CRM",
};

export default function CrmPage() {
  return <CrmView />;
}
