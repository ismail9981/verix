import type { Metadata } from "next";
import { PagePlaceholder } from "../../../components/dashboard/page-placeholder";

export const metadata: Metadata = {
  title: "Bookings",
};

export default function BookingsPage() {
  return (
    <PagePlaceholder title="Bookings" description="Manage appointments and availability." />
  );
}
