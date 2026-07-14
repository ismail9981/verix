"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Reveal, RevealItem } from "../../landing/reveal";
import { PageHeader } from "../ui/page-header";
import {
  ProfileToast,
  type ToastState,
} from "../business-profile/profile-toast";
import { SitesPanel } from "./sites-panel";
import { SitePublishPanel } from "./site-publish-panel";
import { DomainsPanel } from "./domains-panel";
import { PagesPanel } from "./pages-panel";
import { SectionsBuilder } from "./builder/sections-builder";
import type {
  PageListItem,
  PageSectionListItem,
  SiteListItem,
  SiteVersionListItem,
} from "../../../src/server/validators/website";
import type { DomainListItem } from "../../../src/server/validators/domain";
import type { ServiceListItem } from "../../../src/server/validators/service";

interface WebsiteBuilderManagerProps {
  sites: SiteListItem[];
  pages: PageListItem[];
  sections: PageSectionListItem[];
  services: ServiceListItem[];
  selectedSite: SiteListItem | null;
  versions: SiteVersionListItem[];
  domains: DomainListItem[];
  isOwner: boolean;
  selectedSiteId: string | null;
  selectedPageId: string | null;
  selectedSiteName: string | null;
  selectedPageTitle: string | null;
}

export function WebsiteBuilderManager({
  sites,
  pages,
  sections,
  services,
  selectedSite,
  versions,
  domains,
  isOwner,
  selectedSiteId,
  selectedPageId,
  selectedSiteName,
  selectedPageTitle,
}: WebsiteBuilderManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const navigate = useCallback(
    (siteId: string | null, pageId: string | null) => {
      const params = new URLSearchParams();
      if (siteId) params.set("site", siteId);
      if (pageId) params.set("page", pageId);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  const onSelectSite = useCallback(
    (siteId: string | null) => navigate(siteId, null),
    [navigate],
  );
  const onSelectPage = useCallback(
    (pageId: string | null) => navigate(selectedSiteId, pageId),
    [navigate, selectedSiteId],
  );
  const onNotify = useCallback(
    (tone: ToastState["tone"], message: string) => setToast({ tone, message }),
    [],
  );

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <PageHeader
            title="Website Builder"
            subtitle="Manage your sites, pages, and content sections."
          />
        </RevealItem>
        <RevealItem>
          <SitesPanel
            sites={sites}
            selectedSiteId={selectedSiteId}
            onSelectSite={onSelectSite}
            onNotify={onNotify}
          />
        </RevealItem>
        {selectedSite ? (
          <RevealItem appear>
            <SitePublishPanel
              site={selectedSite}
              versions={versions}
              onNotify={onNotify}
            />
          </RevealItem>
        ) : null}
        {selectedSite ? (
          <RevealItem appear>
            <DomainsPanel
              siteId={selectedSite.id}
              siteName={selectedSite.name}
              domains={domains}
              isOwner={isOwner}
              onNotify={onNotify}
            />
          </RevealItem>
        ) : null}
        {selectedSiteId && selectedSiteName ? (
          <RevealItem appear>
            <PagesPanel
              siteId={selectedSiteId}
              siteName={selectedSiteName}
              pages={pages}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              onNotify={onNotify}
            />
          </RevealItem>
        ) : null}
        {selectedPageId && selectedPageTitle ? (
          <RevealItem appear>
            {/* Remount on page switch so the editor's draft state re-seeds. */}
            <SectionsBuilder
              key={selectedPageId}
              pageId={selectedPageId}
              pageTitle={selectedPageTitle}
              sections={sections}
              services={services}
            />
          </RevealItem>
        ) : null}
      </Reveal>

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
