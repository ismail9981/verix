import type { Metadata } from "next";
import { getPrimaryWorkspace } from "../../../src/server/services/workspace.service";
import {
  BusinessProfileEditor,
  type ProfileValues,
} from "../../../components/dashboard/business-profile/profile-editor";
import { ProfileEmpty } from "../../../components/dashboard/business-profile/profile-empty";
import type { Workspace } from "../../../src/server/db/schema";

export const metadata: Metadata = {
  title: "Business Profile",
};

// Reads live workspace data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

function toFormValues(workspace: Workspace): ProfileValues {
  return {
    name: workspace.name,
    slug: workspace.slug,
    email: workspace.email ?? "",
    phone: workspace.phone ?? "",
    website: workspace.website ?? "",
    timezone: workspace.timezone,
    currency: workspace.currency,
    language: workspace.language,
    logoUrl: workspace.logoUrl ?? "",
    coverImageUrl: workspace.coverImageUrl ?? "",
  };
}

export default async function BusinessProfilePage() {
  const workspace = await getPrimaryWorkspace();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Business profile
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage your company information, localization, and branding.
        </p>
      </div>

      {workspace ? (
        <BusinessProfileEditor
          workspaceId={workspace.id}
          initialValues={toFormValues(workspace)}
        />
      ) : (
        <ProfileEmpty />
      )}
    </div>
  );
}
