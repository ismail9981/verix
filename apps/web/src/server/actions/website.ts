"use server";

import { revalidatePath } from "next/cache";
import {
  createPage,
  createSection,
  createSite,
  duplicateSite,
  exportSiteAsTemplate,
  softDeletePage,
  softDeleteSection,
  softDeleteSite,
  syncPageSections,
  updatePage,
  updateSection,
  updateSite,
} from "../services/website.service";
import {
  PublishValidationError,
  publishSite,
  rollbackToVersion,
  unpublishSite,
} from "../services/website-publish.service";
import { createSiteFromTemplate } from "../../website/templates/installer";
import { TemplateExportError } from "../../website/templates/export-model";
import { ensureDefaultSubdomain } from "../services/domain.service";
import {
  createPageSchema,
  createSectionSchema,
  createSiteFromTemplateSchema,
  pageInputSchema,
  publishInputSchema,
  sectionInputSchema,
  siteInputSchema,
  syncPageSectionsSchema,
  type PageSectionListItem,
} from "../validators/website";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { rateLimit } from "../observability/rate-limit";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for the Website Builder. The workspace is always derived from
 * the session via getAuthorizedWorkspace(); parent ids (siteId/pageId) are
 * verified against the workspace in the service layer.
 */

/*
 * Give a new site its default `<slug>.verix.app` subdomain. Best-effort — a
 * failure here must never fail site creation (the user can add one manually).
 */
async function attachDefaultSubdomain(
  workspaceId: string,
  siteId: string,
  siteName: string,
): Promise<void> {
  try {
    await ensureDefaultSubdomain(workspaceId, siteId, siteName);
  } catch (error) {
    await logActionError("ensureDefaultSubdomain", error);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

// --- Sites ----------------------------------------------------------------

function parseSite(formData: FormData) {
  return {
    name: formData.get("name"),
    defaultLocale: formData.get("defaultLocale") ?? undefined,
    status: formData.get("status") ?? undefined,
    themeKey: formData.get("themeKey"),
    seoDefaultTitle: formData.get("seoDefaultTitle"),
    seoTitleTemplate: formData.get("seoTitleTemplate"),
    seoDefaultDescription: formData.get("seoDefaultDescription"),
    seoDefaultImageUrl: formData.get("seoDefaultImageUrl"),
    seoIndexable: formData.get("seoIndexable") ?? "true",
  };
}

export async function createSiteAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = siteInputSchema.safeParse(parseSite(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  let site;
  try {
    site = await createSite(workspaceId, parsed.data);
  } catch (error) {
    await logActionError("createSite", error);
    return { status: "error", message: "Could not create the site." };
  }
  await attachDefaultSubdomain(workspaceId, site.id, site.name);
  revalidatePath("/website-builder");
  return { status: "success", message: "Site created." };
}

export async function updateSiteAction(
  siteId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = siteInputSchema.safeParse(parseSite(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    await updateSite(workspaceId, siteId, parsed.data);
  } catch (error) {
    await logActionError("updateSite", error);
    return { status: "error", message: "Could not update the site." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Site updated." };
}

export async function deleteSiteAction(
  siteId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    await softDeleteSite(workspaceId, siteId);
  } catch (error) {
    await logActionError("deleteSite", error);
    return { status: "error", message: "Could not delete the site." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Site deleted." };
}

/*
 * Create a fully-formed draft site from a template blueprint (pages + sections
 * + theme) in one transaction. Workspace is derived from the session; site
 * creation is an operational action, so any workspace member may run it.
 */
/** Result of a template install — carries the new site id so the UI can select it. */
export interface CreateSiteResult extends FormActionResult {
  siteId?: string;
}

export async function createSiteFromTemplateAction(
  formData: FormData,
): Promise<CreateSiteResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = createSiteFromTemplateSchema.safeParse({
    templateKey: formData.get("templateKey"),
    siteName: formData.get("siteName"),
    locale: formData.get("locale") ?? undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  let siteId: string;
  let siteName: string;
  try {
    ({ siteId, siteName } = await createSiteFromTemplate(workspaceId, parsed.data));
  } catch (error) {
    await logActionError("createSiteFromTemplate", error);
    return { status: "error", message: "Could not create the site." };
  }
  await attachDefaultSubdomain(workspaceId, siteId, siteName);
  revalidatePath("/website-builder");
  return { status: "success", message: "Site created from template.", siteId };
}

/*
 * Deep-duplicate a site into a fresh draft (pages + sections + theme + SEO),
 * excluding published versions. Returns the new site id so the UI can select it.
 */
export async function duplicateSiteAction(
  siteId: string,
): Promise<CreateSiteResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  let newSiteId: string;
  let newName: string;
  try {
    ({ siteId: newSiteId, name: newName } = await duplicateSite(workspaceId, siteId));
  } catch (error) {
    await logActionError("duplicateSite", error);
    return { status: "error", message: "Could not duplicate the site." };
  }
  await attachDefaultSubdomain(workspaceId, newSiteId, newName);
  revalidatePath("/website-builder");
  return { status: "success", message: "Site duplicated.", siteId: newSiteId };
}

/** A downloadable template export — the JSON payload + a suggested filename. */
export interface ExportTemplateResult extends FormActionResult {
  filename?: string;
  template?: string;
}

/*
 * Export a site's structure as reusable TemplateDefinition JSON. Returns the
 * payload for the client to download — nothing is written to disk on the server.
 */
export async function exportTemplateAction(
  siteId: string,
): Promise<ExportTemplateResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    const template = await exportSiteAsTemplate(workspaceId, siteId);
    return {
      status: "success",
      message: "Template exported.",
      filename: `${template.key}.json`,
      template: JSON.stringify(template, null, 2),
    };
  } catch (error) {
    if (error instanceof TemplateExportError) {
      return { status: "error", message: error.message };
    }
    await logActionError("exportTemplate", error);
    return { status: "error", message: "Could not export the template." };
  }
}

// --- Pages ----------------------------------------------------------------

const PAGE_DUPLICATE = "A page with this path and locale already exists.";

function parsePage(formData: FormData) {
  return {
    path: formData.get("path") ?? "",
    title: formData.get("title"),
    locale: formData.get("locale") ?? undefined,
    status: formData.get("status") ?? undefined,
    position: formData.get("position") ?? undefined,
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    seoNoIndex: formData.get("seoNoIndex") ?? "false",
    seoNoFollow: formData.get("seoNoFollow") ?? "false",
    ogTitle: formData.get("ogTitle"),
    ogDescription: formData.get("ogDescription"),
    ogImageUrl: formData.get("ogImageUrl"),
  };
}

export async function createPageAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = createPageSchema.safeParse({
    ...parsePage(formData),
    siteId: formData.get("siteId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    await createPage(workspaceId, parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: PAGE_DUPLICATE,
        fieldErrors: { path: [PAGE_DUPLICATE] },
      };
    }
    await logActionError("createPage", error);
    return { status: "error", message: "Could not create the page." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Page created." };
}

export async function updatePageAction(
  pageId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = pageInputSchema.safeParse(parsePage(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    await updatePage(workspaceId, pageId, parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: PAGE_DUPLICATE,
        fieldErrors: { path: [PAGE_DUPLICATE] },
      };
    }
    await logActionError("updatePage", error);
    return { status: "error", message: "Could not update the page." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Page updated." };
}

export async function deletePageAction(
  pageId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    await softDeletePage(workspaceId, pageId);
  } catch (error) {
    await logActionError("deletePage", error);
    return { status: "error", message: "Could not delete the page." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Page deleted." };
}

// --- Page sections --------------------------------------------------------

function parseSection(formData: FormData) {
  return {
    typeKey: formData.get("typeKey"),
    typeVersion: formData.get("typeVersion") ?? undefined,
    position: formData.get("position") ?? undefined,
    props: formData.get("props") ?? "",
    isVisible: formData.get("isVisible"),
    locale: formData.get("locale") ?? undefined,
  };
}

export async function createSectionAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = createSectionSchema.safeParse({
    ...parseSection(formData),
    pageId: formData.get("pageId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    await createSection(workspaceId, parsed.data);
  } catch (error) {
    await logActionError("createSection", error);
    return { status: "error", message: "Could not create the section." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Section created." };
}

export async function updateSectionAction(
  sectionId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = sectionInputSchema.safeParse(parseSection(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    await updateSection(workspaceId, sectionId, parsed.data);
  } catch (error) {
    await logActionError("updateSection", error);
    return { status: "error", message: "Could not update the section." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Section updated." };
}

export async function deleteSectionAction(
  sectionId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    await softDeleteSection(workspaceId, sectionId);
  } catch (error) {
    await logActionError("deleteSection", error);
    return { status: "error", message: "Could not delete the section." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Section deleted." };
}

/** Result of a builder sync — carries the authoritative sections + id mapping. */
export interface SyncActionResult extends FormActionResult {
  sections?: PageSectionListItem[];
  idMap?: Record<string, string>;
}

/*
 * The single persistence entry point for the visual builder. Reconciles a
 * page's draft sections (autosave / reorder / add / duplicate / hide / delete /
 * undo-redo) in one transaction. Draft only — publishing stays manual.
 */
export async function syncPageSectionsAction(
  input: unknown,
): Promise<SyncActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = syncPageSectionsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Could not save changes.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const { sections, idMap } = await syncPageSections(
      workspaceId,
      parsed.data.pageId,
      parsed.data.sections,
    );
    revalidatePath("/website-builder");
    return { status: "success", message: "Saved.", sections, idMap };
  } catch (error) {
    await logActionError("syncPageSections", error);
    return { status: "error", message: "Could not save changes." };
  }
}

// --- Publishing -----------------------------------------------------------

const PUBLISH_RATE_LIMIT = 10; // publishes
const PUBLISH_WINDOW_MS = 60_000; // per minute per workspace

export async function publishSiteAction(
  siteId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId } = await getAuthorizedWorkspace();

  const { limited } = rateLimit(
    `publish:${workspaceId}`,
    PUBLISH_RATE_LIMIT,
    PUBLISH_WINDOW_MS,
  );
  if (limited) {
    return {
      status: "error",
      message: "Too many publishes. Please wait a moment and try again.",
    };
  }

  const parsed = publishInputSchema.safeParse({ label: formData.get("label") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await publishSite(workspaceId, siteId, userId, parsed.data);
  } catch (error) {
    if (error instanceof PublishValidationError) {
      const summary = error.issues
        .slice(0, 3)
        .map((i) => `${i.pageTitle} · ${i.sectionKey}: ${i.message}`)
        .join(" — ");
      const more =
        error.issues.length > 3 ? ` (+${error.issues.length - 3} more)` : "";
      return { status: "error", message: `Cannot publish. ${summary}${more}` };
    }
    await logActionError("publishSite", error);
    return { status: "error", message: "Could not publish the site." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Site published." };
}

export async function unpublishSiteAction(
  siteId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    await unpublishSite(workspaceId, siteId);
  } catch (error) {
    await logActionError("unpublishSite", error);
    return { status: "error", message: "Could not unpublish the site." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Site unpublished." };
}

export async function rollbackSiteAction(
  siteId: string,
  versionId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    await rollbackToVersion(workspaceId, siteId, versionId);
  } catch (error) {
    await logActionError("rollbackSite", error);
    return { status: "error", message: "Could not roll back the site." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Rolled back to the selected version." };
}
