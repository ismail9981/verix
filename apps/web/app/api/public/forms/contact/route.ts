import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getHostRoutingConfig } from "../../../../../src/server/hosting/config";
import { classifyHost, resolveIncomingHost } from "../../../../../src/server/hosting/host";
import { resolveSiteByHostname } from "../../../../../src/server/hosting/site-resolver.service";
import { getPublishedSnapshot } from "../../../../../src/server/services/website-publish.service";
import {
  createLeadFromPublicSubmission,
  getSiteWorkspaceContext,
} from "../../../../../src/server/services/lead.service";
import { clientIp, hashClientIp } from "../../../../../src/server/observability/client-ip";
import { rateLimit } from "../../../../../src/server/observability/rate-limit";
import { logger } from "../../../../../src/server/observability/logger";
import { zodFieldErrors } from "../../../../../src/server/actions/action-result";
import {
  MAX_BODY_BYTES,
  buildContactSubmissionSchema,
  isHoneypotTriggered,
  isSubmissionTooFast,
  resolveContactFormSection,
  stripSitePreviewPrefix,
} from "../../../../../src/server/validators/lead-public";

/*
 * Public, unauthenticated Contact-form submission endpoint. The published
 * snapshot is the sole source of truth for both "which workspace/site does
 * this belong to" and "does this form exist and accept submissions" — the
 * client never supplies (and this route never trusts) a workspaceId or any
 * form configuration. See `lead-public.ts` for the shared, unit-tested
 * decision logic this orchestrates.
 *
 * Every failure path — unresolved site, unpublished site, unknown page,
 * unknown/disabled form, honeypot trip, too-fast submission — returns the
 * same generic response shape so a prober can't distinguish "no such site"
 * from "form disabled" from "you got rate limited by a different rule."
 */

export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const RATE_LIMIT_ERROR = "Too many requests. Please try again later.";

// Best-effort, per-runtime-instance limits (see `rate-limit.ts`'s docstring on
// the serverless caveat) — a first line of defense, not a hard global quota.
const IP_RATE_LIMIT = 5;
const IP_RATE_WINDOW_MS = 10 * 60_000; // 10 min
const FORM_RATE_LIMIT = 20;
const FORM_RATE_WINDOW_MS = 10 * 60_000; // 10 min

const envelopeSchema = z.object({
  formKey: z.string().trim().min(1).max(60),
  path: z.string().trim().min(1).max(2000),
  siteIdHint: z.uuid().optional(),
  locale: z.string().trim().max(20).optional(),
  honeypot: z.string().max(500).optional().default(""),
  startedAt: z.number().finite(),
});

function genericError(status: number, message = GENERIC_ERROR) {
  return NextResponse.json({ success: false, message }, { status });
}

async function resolveCandidateSite(
  request: NextRequest,
  requestId: string,
  siteIdHint: string | undefined,
): Promise<{ siteId: string; sourceDomain: string | null } | null> {
  const hostConfig = getHostRoutingConfig();
  const rawHost = resolveIncomingHost(request.headers, hostConfig.trustForwardedHost);
  const classification = hostConfig.enabled ? classifyHost(rawHost, hostConfig) : null;
  const sourceDomain = classification?.kind === "public" ? classification.hostname : (rawHost ?? null);

  if (classification?.kind === "public") {
    const route = await resolveSiteByHostname(classification.hostname, requestId);
    if (route) return { siteId: route.siteId, sourceDomain };
  }

  // Fallback: the internal `/site/{siteId}` path (dev, or before a domain is
  // attached). Not a trust escalation — `siteId` is already the public route
  // segment for this exact site, and every subsequent check (published?
  // page exists? form visible in the frozen snapshot?) re-verifies it.
  if (siteIdHint) return { siteId: siteIdHint, sourceDomain };

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const ip = clientIp(request.headers);
  const ipHash = hashClientIp(ip);

  const ipLimit = rateLimit(`leadform:ip:${ipHash}`, IP_RATE_LIMIT, IP_RATE_WINDOW_MS);
  if (ipLimit.limited) return genericError(429, RATE_LIMIT_ERROR);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return genericError(413);

  const rawText = await request.text();
  if (new TextEncoder().encode(rawText).length > MAX_BODY_BYTES) {
    return genericError(413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return genericError(400);
  }

  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success) return genericError(400);
  const { formKey, path, siteIdHint, locale, honeypot, startedAt } = envelope.data;

  // Honeypot / fill-time: pretend success so an automated client learns
  // nothing, but never persist or otherwise act on the submission.
  if (isHoneypotTriggered(honeypot)) {
    logger.info("leadform.honeypot_triggered", { requestId });
    return NextResponse.json({ success: true, message: "Thanks — we'll be in touch soon." });
  }
  const elapsedMs = Date.now() - startedAt;
  if (isSubmissionTooFast(elapsedMs)) {
    logger.info("leadform.too_fast", { requestId, elapsedMs });
    return NextResponse.json({ success: true, message: "Thanks — we'll be in touch soon." });
  }

  const candidate = await resolveCandidateSite(request, requestId, siteIdHint);
  if (!candidate) {
    logger.info("leadform.site_unresolved", { requestId });
    return genericError(404);
  }

  const context = await getSiteWorkspaceContext(candidate.siteId);
  if (!context || context.status !== "published") {
    logger.info("leadform.site_not_published", { requestId, siteId: candidate.siteId });
    return genericError(404);
  }

  const snapshot = await getPublishedSnapshot(candidate.siteId);
  if (!snapshot) {
    logger.info("leadform.snapshot_unavailable", { requestId, siteId: candidate.siteId });
    return genericError(404);
  }

  const normalizedPath = stripSitePreviewPrefix(path, candidate.siteId);
  const resolution = resolveContactFormSection(snapshot, normalizedPath, locale, formKey);
  if (resolution.status !== "ok") {
    logger.info("leadform.form_not_found", {
      requestId,
      siteId: candidate.siteId,
      reason: resolution.status,
    });
    return genericError(404);
  }

  const formLimit = rateLimit(
    `leadform:form:${candidate.siteId}:${resolution.sectionId}`,
    FORM_RATE_LIMIT,
    FORM_RATE_WINDOW_MS,
  );
  if (formLimit.limited) return genericError(429, RATE_LIMIT_ERROR);

  const contentSchema = buildContactSubmissionSchema(resolution.formConfig.fields);
  const content = contentSchema.safeParse(body);
  if (!content.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: zodFieldErrors(content.error),
      },
      { status: 400 },
    );
  }

  try {
    await createLeadFromPublicSubmission({
      workspaceId: context.workspaceId,
      siteId: candidate.siteId,
      pagePath: normalizedPath,
      sourceDomain: candidate.sourceDomain,
      formKey,
      name: content.data.name || null,
      email: content.data.email || null,
      phone: content.data.phone || null,
      subject: content.data.subject || null,
      message: content.data.message || null,
      ipHash,
      userAgent: (request.headers.get("user-agent") ?? "").slice(0, 300) || null,
      metadata: { fillTimeMs: elapsedMs },
    });
  } catch (error) {
    logger.error("leadform.create_failed", {
      requestId,
      errName: error instanceof Error ? error.name : "unknown",
      errMessage: error instanceof Error ? error.message : String(error),
    });
    return genericError(500);
  }

  return NextResponse.json({
    success: true,
    message: resolution.formConfig.successMessage,
  });
}
