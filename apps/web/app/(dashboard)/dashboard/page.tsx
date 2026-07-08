import type { Metadata } from "next";
import { DashboardHome } from "../../../components/dashboard/home/dashboard-home";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return <DashboardHome />;
}
