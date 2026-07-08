import type { Metadata } from "next";
import { PagePlaceholder } from "../../../components/dashboard/page-placeholder";

export const metadata: Metadata = {
  title: "Team",
};

export default function TeamPage() {
  return (
    <PagePlaceholder title="Team" description="Manage members, roles, and permissions." />
  );
}
