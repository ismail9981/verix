import type { Metadata } from "next";
import { BusinessProfileForm } from "../../../components/dashboard/business-profile/business-profile-form";

export const metadata: Metadata = {
  title: "Business Profile",
};

export default function BusinessProfilePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Business profile
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage your company information, branding, hours, locations, and more.
        </p>
      </div>
      <BusinessProfileForm />
    </div>
  );
}
