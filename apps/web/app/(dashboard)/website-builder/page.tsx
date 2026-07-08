import type { Metadata } from "next";
import { WebsiteBuilder } from "../../../components/dashboard/website-builder/website-builder";

export const metadata: Metadata = {
  title: "Website Builder",
};

export default function WebsiteBuilderPage() {
  return <WebsiteBuilder />;
}
