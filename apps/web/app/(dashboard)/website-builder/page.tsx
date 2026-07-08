import type { Metadata } from "next";
import { PagePlaceholder } from "../../../components/dashboard/page-placeholder";

export const metadata: Metadata = {
  title: "Website Builder",
};

export default function WebsiteBuilderPage() {
  return (
    <PagePlaceholder title="Website Builder" description="Create and manage your business website." />
  );
}
