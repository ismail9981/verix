import type { Metadata } from "next";
import { getAuthorizedWorkspace } from "../../../src/server/auth/workspace";
import {
  listPages,
  listSections,
  listSites,
} from "../../../src/server/services/website.service";
import { listVersions } from "../../../src/server/services/website-publish.service";
import { listDomains } from "../../../src/server/services/domain.service";
import { listServices } from "../../../src/server/services/service.service";
import { WebsiteBuilderManager } from "../../../components/dashboard/website-builder/website-builder-manager";

export const metadata: Metadata = {
  title: "Website Builder",
};

// Reads live builder data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ site?: string; page?: string }>;
}

export default async function WebsiteBuilderPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { workspaceId, role } = await getAuthorizedWorkspace();

  const sites = await listSites(workspaceId);
  const selectedSite =
    (params.site && sites.find((s) => s.id === params.site)) || null;
  const selectedSiteId = selectedSite?.id ?? null;

  const pages = selectedSiteId
    ? await listPages(workspaceId, selectedSiteId)
    : [];
  const selectedPage =
    (params.page && pages.find((p) => p.id === params.page)) || null;
  const selectedPageId = selectedPage?.id ?? null;

  const [sections, services, versions, domains] = await Promise.all([
    selectedPageId ? listSections(workspaceId, selectedPageId) : [],
    // For the Services-section live preview in the editor.
    selectedPageId ? listServices(workspaceId, { status: "active" }) : [],
    // Version history for the publish panel.
    selectedSiteId ? listVersions(workspaceId, selectedSiteId) : [],
    // Domains for the domains panel.
    selectedSiteId ? listDomains(workspaceId, selectedSiteId) : [],
  ]);

  return (
    <WebsiteBuilderManager
      sites={sites}
      pages={pages}
      sections={sections}
      services={services}
      selectedSite={selectedSite}
      versions={versions}
      domains={domains}
      isOwner={role === "owner"}
      selectedSiteId={selectedSiteId}
      selectedPageId={selectedPageId}
      selectedSiteName={selectedSite?.name ?? null}
      selectedPageTitle={selectedPage?.title ?? null}
    />
  );
}
