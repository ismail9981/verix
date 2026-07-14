"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { PlusIcon } from "../icons";
import { Badge } from "../ui/badge";
import { RowActionsMenu } from "../ui/row-actions";
import { DetailDrawer } from "../detail-drawer";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import {
  deleteSiteAction,
  duplicateSiteAction,
  exportTemplateAction,
  updateSiteAction,
} from "../../../src/server/actions/website";
import { CreateSiteWizard } from "./create-site/create-site-wizard";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { SiteListItem } from "../../../src/server/validators/website";
import type { DomainListItem } from "../../../src/server/validators/domain";
import { listThemes } from "../../../src/website/theme/registry";
import { formatDate, previewHostname, siteStatusLabel, siteStatusTone } from "./website-format";
import { SeoDescriptionCounter, SeoTitleCounter, SearchResultPreview, SocialCardPreview } from "./seo-preview";
import type { Notify } from "./types";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
];

const INDEXABLE_OPTIONS = [
  { value: "true", label: "Indexable — allow search engines to crawl this site" },
  { value: "false", label: "Not indexable — block all crawling (robots.txt disallows everything)" },
];

// Theme options for the site; "" resolves to the default theme at render time.
const THEME_OPTIONS = [
  { value: "", label: "Default theme" },
  ...listThemes().map((t) => ({ value: t.key, label: `${t.displayName} theme` })),
];

const TH = "px-5 py-2.5 font-medium";
const CELL = "px-5 py-3";

/** Trigger a browser download of a JSON string — no server file is written. */
function downloadJson(filename: string, json: string): void {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

interface SitesPanelProps {
  sites: SiteListItem[];
  selectedSiteId: string | null;
  /** Domains for the currently *selected* site only — used just for the SEO preview's hostname label, and only trusted below when the drawer is editing that same site. */
  domains: DomainListItem[];
  onSelectSite: (siteId: string | null) => void;
  onNotify: Notify;
}

type OptimisticAction =
  | { type: "update"; site: SiteListItem }
  | { type: "delete"; id: string };

export function SitesPanel({
  sites,
  selectedSiteId,
  domains,
  onSelectSite,
  onNotify,
}: SitesPanelProps) {
  const [items, apply] = useOptimistic(sites, (state, a: OptimisticAction) => {
    if (a.type === "update")
      return state.map((s) => (s.id === a.site.id ? a.site : s));
    return state.filter((s) => s.id !== a.id);
  });
  const [isPending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<{
    open: boolean;
    site: SiteListItem | null;
  }>({ open: false, site: null });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewDescription, setPreviewDescription] = useState("");

  // `domains` is only fetched for `selectedSiteId` — only trust it as the
  // preview hostname when the drawer is editing that same site.
  const hostname =
    drawer.site && drawer.site.id === selectedSiteId ? previewHostname(domains) : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const site = drawer.site;
    if (!site) return;
    const formData = new FormData(event.currentTarget);
    const optimistic: SiteListItem = {
      id: site.id,
      name: String(formData.get("name") ?? ""),
      defaultLocale: String(formData.get("defaultLocale") ?? "en-us"),
      status: String(formData.get("status") ?? "draft") as SiteListItem["status"],
      themeKey: String(formData.get("themeKey") ?? "") || null,
      publishedVersionId: site.publishedVersionId,
      pageCount: site.pageCount,
      createdAt: site.createdAt,
      seoDefaultTitle: String(formData.get("seoDefaultTitle") ?? "").trim() || null,
      seoTitleTemplate: String(formData.get("seoTitleTemplate") ?? "").trim() || null,
      seoDefaultDescription: String(formData.get("seoDefaultDescription") ?? "").trim() || null,
      seoDefaultImageUrl: String(formData.get("seoDefaultImageUrl") ?? "").trim() || null,
      seoIndexable: formData.get("seoIndexable") === "true",
    };
    startTransition(async () => {
      apply({ type: "update", site: optimistic });
      const result = await updateSiteAction(site.id, formData);
      if (result.status === "success") {
        setFieldErrors({});
        setDrawer((d) => ({ ...d, open: false }));
      } else {
        setFieldErrors(result.fieldErrors ?? {});
      }
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function handleDelete(site: SiteListItem) {
    startTransition(async () => {
      apply({ type: "delete", id: site.id });
      if (selectedSiteId === site.id) onSelectSite(null);
      const result = await deleteSiteAction(site.id);
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function handleDuplicate(site: SiteListItem) {
    startTransition(async () => {
      const result = await duplicateSiteAction(site.id);
      if (result.status === "success" && result.siteId) {
        onSelectSite(result.siteId);
      }
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function handleExport(site: SiteListItem) {
    startTransition(async () => {
      const result = await exportTemplateAction(site.id);
      if (result.status === "success" && result.template && result.filename) {
        downloadJson(result.filename, result.template);
      }
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function openEdit(site: SiteListItem) {
    setFieldErrors({});
    setDrawer({ open: true, site });
    setPreviewTitle(site.seoDefaultTitle ?? "");
    setPreviewDescription(site.seoDefaultDescription ?? "");
  }

  return (
    <>
      <SectionCard
        id="sites"
        title="Sites"
        bodyClassName="p-0"
        action={
          <Button
            type="button"
            size="sm"
            className={CTA_SECONDARY}
            leftIcon={<PlusIcon className="h-4 w-4" />}
            onClick={() => setWizardOpen(true)}
          >
            New site
          </Button>
        }
      >
        {items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">
            No sites yet. Create your first site to begin.
          </p>
        ) : (
          <div
            aria-busy={isPending}
            className={`transition-opacity ${isPending ? "opacity-60" : ""}`}
          >
            <table className="w-full text-sm">
              <caption className="sr-only">Sites</caption>
              <thead>
                <tr className="border-y border-hairline text-left text-xs text-muted">
                  <th scope="col" className={TH}>Name</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={`hidden sm:table-cell ${TH}`}>Pages</th>
                  <th scope="col" className={`hidden md:table-cell ${TH}`}>Created</th>
                  <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((site) => {
                  const active = site.id === selectedSiteId;
                  return (
                    <tr
                      key={site.id}
                      onClick={() => onSelectSite(active ? null : site.id)}
                      className={`cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50 ${active ? "bg-canvas/40" : ""}`}
                    >
                      <td className={`${CELL} font-medium text-white`}>{site.name}</td>
                      <td className={CELL}>
                        <Badge tone={siteStatusTone(site.status)}>
                          {siteStatusLabel(site.status)}
                        </Badge>
                      </td>
                      <td className={`${CELL} hidden tabular-nums text-muted sm:table-cell`}>
                        {site.pageCount}
                      </td>
                      <td className={`${CELL} hidden whitespace-nowrap text-muted md:table-cell`}>
                        {formatDate(site.createdAt)}
                      </td>
                      <td className={`${CELL} text-right`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowActionsMenu
                            label={`Actions for ${site.name}`}
                            actions={[
                              { label: active ? "Hide pages" : "Manage pages", onSelect: () => onSelectSite(active ? null : site.id) },
                              { label: "Edit", onSelect: () => openEdit(site) },
                              { label: "Duplicate site", onSelect: () => handleDuplicate(site) },
                              { label: "Export template", onSelect: () => handleExport(site) },
                              { label: "Delete", danger: true, onSelect: () => handleDelete(site) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <DetailDrawer
        key={`edit-${drawer.site?.id ?? "none"}`}
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        title="Edit site"
        subtitle="A publishable website for this workspace."
        ariaLabel="Edit site"
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <div className="flex flex-col gap-5">
            <FieldInput
              label="Name"
              name="name"
              required
              defaultValue={drawer.site?.name ?? ""}
              error={fieldErrors.name?.[0]}
            />
            <div className="grid grid-cols-2 gap-4">
              <FieldInput
                label="Default locale"
                name="defaultLocale"
                defaultValue={drawer.site?.defaultLocale ?? "en-us"}
                error={fieldErrors.defaultLocale?.[0]}
              />
              <FieldSelect
                label="Status"
                name="status"
                options={STATUS_OPTIONS}
                defaultValue={drawer.site?.status ?? "draft"}
              />
            </div>
            <FieldSelect
              label="Theme"
              name="themeKey"
              options={THEME_OPTIONS}
              defaultValue={drawer.site?.themeKey ?? ""}
            />

            <div className="border-t border-hairline pt-5">
              <p className="mb-4 text-sm font-medium text-white">SEO defaults</p>
              <p className="mb-4 text-xs text-muted">
                Used as a fallback whenever a page doesn&apos;t set its own SEO title/description.
              </p>
              <div className="flex flex-col gap-4">
                <div>
                  <FieldInput
                    label="Default title"
                    name="seoDefaultTitle"
                    value={previewTitle}
                    onChange={(e) => setPreviewTitle(e.target.value)}
                    error={fieldErrors.seoDefaultTitle?.[0]}
                  />
                  <SeoTitleCounter value={previewTitle} />
                </div>
                <FieldInput
                  label="Title template"
                  name="seoTitleTemplate"
                  placeholder="%s · Acme Co"
                  defaultValue={drawer.site?.seoTitleTemplate ?? ""}
                  helperText="%s is replaced with each page's title. Leave blank to use the default 'Page · Site name' format."
                  error={fieldErrors.seoTitleTemplate?.[0]}
                />
                <div>
                  <FieldInput
                    label="Default description"
                    name="seoDefaultDescription"
                    value={previewDescription}
                    onChange={(e) => setPreviewDescription(e.target.value)}
                    error={fieldErrors.seoDefaultDescription?.[0]}
                  />
                  <SeoDescriptionCounter value={previewDescription} />
                </div>
                <FieldInput
                  label="Default social image URL"
                  name="seoDefaultImageUrl"
                  placeholder="https://…"
                  defaultValue={drawer.site?.seoDefaultImageUrl ?? ""}
                  error={fieldErrors.seoDefaultImageUrl?.[0]}
                />
                <FieldSelect
                  label="Search engine indexing"
                  name="seoIndexable"
                  options={INDEXABLE_OPTIONS}
                  defaultValue={String(drawer.site?.seoIndexable ?? true)}
                />
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <SearchResultPreview
                  title={previewTitle || drawer.site?.name || ""}
                  description={previewDescription}
                  path=""
                  hostname={hostname}
                />
                <SocialCardPreview
                  title={previewTitle || drawer.site?.name || ""}
                  description={previewDescription}
                  imageUrl={drawer.site?.seoDefaultImageUrl ?? undefined}
                  hostname={hostname}
                />
              </div>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-end gap-3">
            <Button type="button" className={CTA_SECONDARY} onClick={() => setDrawer((d) => ({ ...d, open: false }))}>
              Cancel
            </Button>
            <Button type="submit" className={CTA_PRIMARY} loading={isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </DetailDrawer>

      <CreateSiteWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(siteId) => onSelectSite(siteId)}
        onNotify={onNotify}
      />
    </>
  );
}
