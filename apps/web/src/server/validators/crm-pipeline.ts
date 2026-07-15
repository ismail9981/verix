import { z } from "zod";
import { cleanOptional } from "./shared";

/*
 * Validation + pure decision logic for the CRM pipeline (Sprint 10):
 * pipelines, stages, and opportunities. Dependency-free (no db/env imports)
 * so every invariant here is unit-testable — mirrors the split `lead-public.ts`
 * established for the public form (pure decisions vs. `lead.service.ts`'s DB
 * access). Activity-specific schemas/logic live in `crm-activity.ts`.
 */

// ---------------------------------------------------------------------------
// Stage tone / status vocabulary (kept in sync with `db/schema/enums.ts`)
// ---------------------------------------------------------------------------

export const CRM_STAGE_TONES = [
  "neutral",
  "info",
  "warning",
  "success",
  "danger",
  "accent",
] as const;
export type CrmStageTone = (typeof CRM_STAGE_TONES)[number];

export const CRM_OPPORTUNITY_STATUSES = ["open", "won", "lost"] as const;
export type CrmOpportunityStatus = (typeof CRM_OPPORTUNITY_STATUSES)[number];

export const CRM_OPPORTUNITY_FILTER_STATUSES = [
  "all",
  ...CRM_OPPORTUNITY_STATUSES,
] as const;
export type CrmOpportunityFilterStatus =
  (typeof CRM_OPPORTUNITY_FILTER_STATUSES)[number];

// ---------------------------------------------------------------------------
// Default pipeline (auto-provisioned per workspace)
// ---------------------------------------------------------------------------

export const DEFAULT_PIPELINE_NAME = "Sales";

export interface DefaultStageSeed {
  name: string;
  position: number;
  probabilityPercent: number;
  tone: CrmStageTone;
  isWon: boolean;
  isLost: boolean;
  isProtected: boolean;
}

/** The 7 stages every workspace's default pipeline is seeded with, in order. */
export const DEFAULT_STAGES: readonly DefaultStageSeed[] = [
  { name: "New", position: 0, probabilityPercent: 10, tone: "neutral", isWon: false, isLost: false, isProtected: true },
  { name: "Contacted", position: 1, probabilityPercent: 20, tone: "info", isWon: false, isLost: false, isProtected: true },
  { name: "Qualified", position: 2, probabilityPercent: 40, tone: "info", isWon: false, isLost: false, isProtected: true },
  { name: "Proposal", position: 3, probabilityPercent: 60, tone: "warning", isWon: false, isLost: false, isProtected: true },
  { name: "Negotiation", position: 4, probabilityPercent: 80, tone: "warning", isWon: false, isLost: false, isProtected: true },
  { name: "Won", position: 5, probabilityPercent: 100, tone: "success", isWon: true, isLost: false, isProtected: true },
  { name: "Lost", position: 6, probabilityPercent: 0, tone: "danger", isWon: false, isLost: true, isProtected: true },
] as const;

// ---------------------------------------------------------------------------
// Pipeline / stage schemas
// ---------------------------------------------------------------------------

export const createPipelineSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;

export const createStageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  probabilityPercent: z.coerce.number().int().min(0).max(100).default(0),
  tone: z.enum(CRM_STAGE_TONES).default("neutral"),
});
export type CreateStageInput = z.infer<typeof createStageSchema>;

export const updateStageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  probabilityPercent: z.coerce.number().int().min(0).max(100),
  tone: z.enum(CRM_STAGE_TONES),
});
export type UpdateStageInput = z.infer<typeof updateStageSchema>;

export const reorderStagesSchema = z.object({
  stageIds: z.array(z.uuid()).min(1),
});
export type ReorderStagesInput = z.infer<typeof reorderStagesSchema>;

// ---------------------------------------------------------------------------
// Opportunity schemas
// ---------------------------------------------------------------------------

export const createOpportunitySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  valueCents: z.coerce.number().int().min(0).max(999_999_999).default(0),
  pipelineId: z.uuid(),
  stageId: z.preprocess(cleanOptional, z.uuid().optional()),
  leadId: z.preprocess(cleanOptional, z.uuid().optional()),
  customerId: z.preprocess(cleanOptional, z.uuid().optional()),
  assignedToUserId: z.preprocess(cleanOptional, z.uuid().optional()),
  expectedCloseDate: z.preprocess(cleanOptional, z.iso.date().optional()),
});
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

export const updateOpportunitySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  valueCents: z.coerce.number().int().min(0).max(999_999_999),
  expectedCloseDate: z.preprocess(cleanOptional, z.iso.date().optional()),
  assignedToUserId: z.preprocess(cleanOptional, z.uuid().optional()),
});
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;

export const moveOpportunitySchema = z.object({
  stageId: z.uuid(),
});
export type MoveOpportunityInput = z.infer<typeof moveOpportunitySchema>;

export const markOpportunityLostSchema = z.object({
  lossReason: z.preprocess(cleanOptional, z.string().max(500).optional()),
});
export type MarkOpportunityLostInput = z.infer<typeof markOpportunityLostSchema>;

export const opportunityFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(CRM_OPPORTUNITY_FILTER_STATUSES).catch("all"),
  pipelineId: z.preprocess(cleanOptional, z.uuid().optional()),
  assignedToUserId: z.preprocess(cleanOptional, z.uuid().optional()),
});
export type OpportunityFilters = z.infer<typeof opportunityFiltersSchema>;

// ---------------------------------------------------------------------------
// Pure decision logic
// ---------------------------------------------------------------------------

/** Weighted pipeline value: the opportunity's value scaled by its stage's win probability. */
export function weightedValueCents(
  valueCents: number,
  probabilityPercent: number,
): number {
  return Math.round((valueCents * probabilityPercent) / 100);
}

/**
 * Status is derived from the stage an opportunity sits in, never set
 * independently — this is what keeps "won/lost" consistent with the
 * destination stage after every move. `markOpportunityWon`/`markOpportunityLost`
 * are wrappers that move the opportunity to the pipeline's is-won/is-lost stage.
 */
export function deriveStatusForStage(stage: {
  isWon: boolean;
  isLost: boolean;
}): CrmOpportunityStatus {
  if (stage.isWon) return "won";
  if (stage.isLost) return "lost";
  return "open";
}

/** A stage may only receive opportunities from its own pipeline (cross-tenant/cross-pipeline safety). */
export function isStageInPipeline(
  stage: { pipelineId: string },
  pipelineId: string,
): boolean {
  return stage.pipelineId === pipelineId;
}

/** `reorderPipelineStages` may only reorder — the submitted id set must be an exact permutation of the existing one. */
export function isValidStageReorder(
  existingIds: readonly string[],
  submittedIds: readonly string[],
): boolean {
  if (existingIds.length !== submittedIds.length) return false;
  const a = [...existingIds].sort();
  const b = [...submittedIds].sort();
  return a.every((id, i) => id === b[i]);
}

/**
 * Duplicate-opportunity policy: a lead may have at most one *open* opportunity
 * at a time — creating another from the same lead is rejected in favor of
 * moving the existing one. Customer-only and manual entries are never deduped
 * (a customer can have several concurrent deals), and a lead's own *closed*
 * (won/lost) opportunities don't block a new one (e.g. a repeat customer).
 */
export function findOpenOpportunityForLead(
  candidates: readonly { id: string; leadId: string | null; status: CrmOpportunityStatus }[],
  leadId: string,
): { id: string } | null {
  return candidates.find((c) => c.leadId === leadId && c.status === "open") ?? null;
}

/** List/detail/activity/metrics scope for the current actor — the single rule every CRM read path threads through. */
export type OpportunityScope =
  | { kind: "all" }
  | { kind: "assigned"; userId: string };

export function resolveOpportunityScope(
  role: string,
  actorUserId: string,
): OpportunityScope {
  if (role === "owner" || role === "manager") return { kind: "all" };
  return { kind: "assigned", userId: actorUserId };
}

/** Thrown when creating an opportunity for a lead that already has an open one. */
export const DUPLICATE_LEAD_OPPORTUNITY_ERROR = "DUPLICATE_LEAD_OPPORTUNITY";
