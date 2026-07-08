import type { Metadata } from "next";
import { PagePlaceholder } from "../../../components/dashboard/page-placeholder";

export const metadata: Metadata = {
  title: "AI Assistant",
};

export default function AiPage() {
  return (
    <PagePlaceholder title="AI Assistant" description="Generate content and automate your work." />
  );
}
