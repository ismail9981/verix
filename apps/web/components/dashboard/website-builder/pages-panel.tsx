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
  createPageAction,
  deletePageAction,
  updatePageAction,
} from "../../../src/server/actions/website";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { PageListItem } from "../../../src/server/validators/website";
import type { DomainListItem } from "../../../src/server/validators/domain";
import {
  displayPath,
  pageStatusLabel,
  pageStatusTone,
  previewHostname,
} from "./website-format";
import { SeoDescriptionCounter, SeoTitleCounter, SearchResultPreview, SocialCardPreview } from "./seo-preview";
import type { Notify } from "./types";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
];

const NOINDEX_OPTIONS = [
  { value: "false", label: "Index — include in search results" },
  { value: "true", label: "No-index — hide from search results" },
];
const NOFOLLOW_OPTIONS = [
  { value: "false", label: "Follow — let search engines follow its links" },
  { value: "true", label: "No-follow — don't pass link credit" },
];

const TH = "px-5 py-2.5 font-medium";
const CELL = "px-5 py-3";

interface PagesPanelProps {
  siteName: string;
  siteId: string;
  pages: PageListItem[];
  /** This site's domains — used only for the SEO preview's hostname label. */
  domains: DomainListItem[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string | null) => void;
  onNotify: Notify;
}

type OptimisticAction =
  | { type: "create"; page: PageListItem }
  | { type: "update"; page: PageListItem }
  | { type: "delete"; id: string };

export function PagesPanel({
  siteName,
  siteId,
  pages,
  domains,
  selectedPageId,
  onSelectPage,
  onNotify,
}: PagesPanelProps) {
  const [items, apply] = useOptimistic(pages, (state, a: OptimisticAction) => {
    if (a.type === "create") return [...state, a.page];
    if (a.type === "update")
      return state.map((p) => (p.id === a.page.id ? a.page : p));
    return state.filter((p) => p.id !== a.id);
  });
  const [isPending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<{
    open: boolean;
    mode: "create" | "edit";
    page: PageListItem | null;
  }>({ open: false, mode: "create", page: null });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewDescription, setPreviewDescription] = useState("");
  const [previewPath, setPreviewPath] = useState("");
  const hostname = previewHostname(domains);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const isEdit = drawer.mode === "edit" && drawer.page;
    const optimistic: PageListItem = {
      id: isEdit ? drawer.page!.id : `optimistic-${Date.now()}`,
      siteId,
      path: String(formData.get("path") ?? ""),
      title: String(formData.get("title") ?? ""),
      locale: String(formData.get("locale") ?? "en-us"),
      status: String(formData.get("status") ?? "draft") as PageListItem["status"],
      position: Number(formData.get("position") ?? 0),
      seoTitle: String(formData.get("seoTitle") ?? "").trim() || null,
      seoDescription: String(formData.get("seoDescription") ?? "").trim() || null,
      sectionCount: isEdit ? drawer.page!.sectionCount : 0,
      createdAt: isEdit ? drawer.page!.createdAt : new Date(),
      seoNoIndex: formData.get("seoNoIndex") === "true",
      seoNoFollow: formData.get("seoNoFollow") === "true",
      ogTitle: String(formData.get("ogTitle") ?? "").trim() || null,
      ogDescription: String(formData.get("ogDescription") ?? "").trim() || null,
      ogImageUrl: String(formData.get("ogImageUrl") ?? "").trim() || null,
    };
    startTransition(async () => {
      apply(isEdit ? { type: "update", page: optimistic } : { type: "create", page: optimistic });
      const result = isEdit
        ? await updatePageAction(drawer.page!.id, formData)
        : await createPageAction(formData);
      if (result.status === "success") {
        setFieldErrors({});
        setDrawer((d) => ({ ...d, open: false }));
      } else {
        setFieldErrors(result.fieldErrors ?? {});
      }
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function handleDelete(page: PageListItem) {
    startTransition(async () => {
      apply({ type: "delete", id: page.id });
      if (selectedPageId === page.id) onSelectPage(null);
      const result = await deletePageAction(page.id);
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function openCreate() {
    setFieldErrors({});
    setDrawer({ open: true, mode: "create", page: null });
    setPreviewTitle("");
    setPreviewDescription("");
    setPreviewPath("");
  }
  function openEdit(page: PageListItem) {
    setFieldErrors({});
    setDrawer({ open: true, mode: "edit", page });
    setPreviewTitle(page.seoTitle ?? page.title);
    setPreviewDescription(page.seoDescription ?? "");
    setPreviewPath(page.path);
  }

  return (
    <>
      <SectionCard
        id="pages"
        title={`Pages · ${siteName}`}
        bodyClassName="p-0"
        action={
          <Button
            type="button"
            size="sm"
            className={CTA_SECONDARY}
            leftIcon={<PlusIcon className="h-4 w-4" />}
            onClick={openCreate}
          >
            New page
          </Button>
        }
      >
        {items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">
            No pages yet. Add a page to this site.
          </p>
        ) : (
          <div
            aria-busy={isPending}
            className={`transition-opacity ${isPending ? "opacity-60" : ""}`}
          >
            <table className="w-full text-sm">
              <caption className="sr-only">Pages</caption>
              <thead>
                <tr className="border-y border-hairline text-left text-xs text-muted">
                  <th scope="col" className={TH}>Title</th>
                  <th scope="col" className={`hidden sm:table-cell ${TH}`}>Path</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={`hidden md:table-cell ${TH}`}>Sections</th>
                  <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((page) => {
                  const active = page.id === selectedPageId;
                  return (
                    <tr
                      key={page.id}
                      onClick={() => onSelectPage(active ? null : page.id)}
                      className={`cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50 ${active ? "bg-canvas/40" : ""}`}
                    >
                      <td className={`${CELL} font-medium text-white`}>{page.title}</td>
                      <td className={`${CELL} hidden font-mono text-xs text-muted sm:table-cell`}>
                        {displayPath(page.path)}
                      </td>
                      <td className={CELL}>
                        <Badge tone={pageStatusTone(page.status)}>
                          {pageStatusLabel(page.status)}
                        </Badge>
                      </td>
                      <td className={`${CELL} hidden tabular-nums text-muted md:table-cell`}>
                        {page.sectionCount}
                      </td>
                      <td className={`${CELL} text-right`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowActionsMenu
                            label={`Actions for ${page.title}`}
                            actions={[
                              { label: active ? "Hide sections" : "Manage sections", onSelect: () => onSelectPage(active ? null : page.id) },
                              { label: "Edit", onSelect: () => openEdit(page) },
                              { label: "Delete", danger: true, onSelect: () => handleDelete(page) },
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
        key={`${drawer.mode}-${drawer.page?.id ?? "new"}`}
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        title={drawer.mode === "create" ? "New page" : "Edit page"}
        subtitle={siteName}
        ariaLabel={drawer.mode === "create" ? "New page" : "Edit page"}
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <input type="hidden" name="siteId" value={siteId} />
          <div className="flex flex-col gap-5">
            <FieldInput
              label="Title"
              name="title"
              required
              defaultValue={drawer.page?.title ?? ""}
              error={fieldErrors.title?.[0]}
            />
            <FieldInput
              label="Path"
              name="path"
              placeholder="about (blank = home)"
              defaultValue={drawer.page?.path ?? ""}
              error={fieldErrors.path?.[0]}
            />
            <div className="grid grid-cols-3 gap-4">
              <FieldInput
                label="Locale"
                name="locale"
                defaultValue={drawer.page?.locale ?? "en-us"}
              />
              <FieldSelect
                label="Status"
                name="status"
                options={STATUS_OPTIONS}
                defaultValue={drawer.page?.status ?? "draft"}
              />
              <FieldInput
                label="Position"
                name="position"
                type="number"
                min={0}
                defaultValue={String(drawer.page?.position ?? 0)}
              />
            </div>
            <div>
              <FieldInput
                label="SEO title"
                name="seoTitle"
                value={previewTitle}
                onChange={(e) => setPreviewTitle(e.target.value)}
                placeholder={drawer.page?.title}
              />
              <SeoTitleCounter value={previewTitle} />
            </div>
            <div>
              <FieldInput
                label="SEO description"
                name="seoDescription"
                value={previewDescription}
                onChange={(e) => setPreviewDescription(e.target.value)}
              />
              <SeoDescriptionCounter value={previewDescription} />
            </div>

            <div className="border-t border-hairline pt-5">
              <p className="mb-4 text-sm font-medium text-white">Search &amp; social</p>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <FieldSelect
                    label="Indexing"
                    name="seoNoIndex"
                    options={NOINDEX_OPTIONS}
                    defaultValue={String(drawer.page?.seoNoIndex ?? false)}
                  />
                  <FieldSelect
                    label="Link following"
                    name="seoNoFollow"
                    options={NOFOLLOW_OPTIONS}
                    defaultValue={String(drawer.page?.seoNoFollow ?? false)}
                  />
                </div>
                <FieldInput
                  label="Social title"
                  name="ogTitle"
                  placeholder={previewTitle || drawer.page?.title}
                  defaultValue={drawer.page?.ogTitle ?? ""}
                />
                <FieldInput
                  label="Social description"
                  name="ogDescription"
                  placeholder={previewDescription}
                  defaultValue={drawer.page?.ogDescription ?? ""}
                />
                <FieldInput
                  label="Social image URL"
                  name="ogImageUrl"
                  placeholder="https://… (leave blank to use the site default or an auto-generated image)"
                  defaultValue={drawer.page?.ogImageUrl ?? ""}
                />
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <SearchResultPreview
                  title={previewTitle || drawer.page?.title || ""}
                  description={previewDescription}
                  path={previewPath}
                  hostname={hostname}
                />
                <SocialCardPreview
                  title={previewTitle || drawer.page?.title || ""}
                  description={previewDescription}
                  imageUrl={drawer.page?.ogImageUrl ?? undefined}
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
              {drawer.mode === "create" ? "Create page" : "Save changes"}
            </Button>
          </div>
        </form>
      </DetailDrawer>
    </>
  );
}
