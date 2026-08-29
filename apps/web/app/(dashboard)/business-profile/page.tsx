import type { Metadata } from "next";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";
import { getWorkspaceById } from "../../../src/server/services/workspace.service";
import { listServices } from "../../../src/server/services/service.service";
import { serviceFiltersSchema } from "../../../src/server/validators/service";
import {
  BusinessProfileEditor,
  type ProfileValues,
} from "../../../components/dashboard/business-profile/profile-editor";
import { ServicesManager } from "../../../components/dashboard/business-profile/services-manager";
import { ProfileEmpty } from "../../../components/dashboard/business-profile/profile-empty";
import type { Workspace } from "../../../src/server/db/schema";
import { hasCapability } from "../../../src/server/auth/capabilities";

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

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function BusinessProfilePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = serviceFiltersSchema.parse({
    search: params.q ?? "",
    status: params.status ?? "all",
  });

  const activeWorkspace = await requirePageCapability(
    "workspace.settings.read",
  );
  const { workspaceId } = activeWorkspace;
  const canUpdateSettings = hasCapability(
    activeWorkspace,
    "workspace.settings.update",
  );
  const canManageServices = hasCapability(activeWorkspace, "services.manage");
  const workspace = await getWorkspaceById(workspaceId);
  const services = workspace ? await listServices(workspaceId, filters) : [];

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
        <div className="flex flex-col gap-10">
          <BusinessProfileEditor
            initialValues={toFormValues(workspace)}
            canUpdate={canUpdateSettings}
          />
          <ServicesManager
            initialServices={services}
            filters={filters}
            canManage={canManageServices}
          />
        </div>
      ) : (
        <ProfileEmpty />
      )}
    </div>
  );
}
