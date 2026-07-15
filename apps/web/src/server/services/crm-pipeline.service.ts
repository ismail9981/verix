import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/db";
import { crmOpportunities, crmPipelines, crmStages } from "../db/schema";
import { assertCanMutateStage } from "../auth/rbac";
import {
  DEFAULT_PIPELINE_NAME,
  DEFAULT_STAGES,
  isValidStageReorder,
  type CreatePipelineInput,
  type CreateStageInput,
  type CrmStageTone,
  type UpdateStageInput,
} from "../validators/crm-pipeline";

/*
 * CRM pipeline/stage service — reusable data access for a workspace's sales
 * pipeline configuration. Every query is scoped to `workspaceId` and excludes
 * soft-deleted rows, the same tenant-isolation pattern as `customer.service.ts`.
 *
 * `ensureDefaultPipeline` is idempotent and safe to call from multiple
 * request paths (workspace provisioning, or lazily from the first CRM page
 * load) — the partial unique index on `(workspace_id) WHERE is_default` is
 * the real guarantee; a concurrent-insert race is caught and resolved by
 * re-reading rather than by locking.
 */

export interface StageDto {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  probabilityPercent: number;
  tone: CrmStageTone;
  isWon: boolean;
  isLost: boolean;
  isProtected: boolean;
}

export interface PipelineDto {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface PipelineWithStages extends PipelineDto {
  stages: StageDto[];
}

const STAGE_COLUMNS = {
  id: crmStages.id,
  pipelineId: crmStages.pipelineId,
  name: crmStages.name,
  position: crmStages.position,
  probabilityPercent: crmStages.probabilityPercent,
  tone: crmStages.tone,
  isWon: crmStages.isWon,
  isLost: crmStages.isLost,
  isProtected: crmStages.isProtected,
};

async function loadStages(
  workspaceId: string,
  pipelineId: string,
): Promise<StageDto[]> {
  return db
    .select(STAGE_COLUMNS)
    .from(crmStages)
    .where(
      and(
        eq(crmStages.workspaceId, workspaceId),
        eq(crmStages.pipelineId, pipelineId),
        isNull(crmStages.deletedAt),
      ),
    )
    .orderBy(asc(crmStages.position));
}

async function findDefaultPipeline(
  workspaceId: string,
): Promise<PipelineWithStages | null> {
  const rows = await db
    .select({ id: crmPipelines.id, name: crmPipelines.name, isDefault: crmPipelines.isDefault })
    .from(crmPipelines)
    .where(
      and(
        eq(crmPipelines.workspaceId, workspaceId),
        eq(crmPipelines.isDefault, true),
        isNull(crmPipelines.deletedAt),
      ),
    )
    .limit(1);
  const pipeline = rows[0];
  if (!pipeline) return null;
  return { ...pipeline, stages: await loadStages(workspaceId, pipeline.id) };
}

/**
 * Idempotently provisions the workspace's one default pipeline with its 7
 * seed stages. Called both for brand-new workspaces (fire-and-forget from
 * `resolveAuthorizedWorkspace`, outside its atomic tx so a failure here never
 * blocks sign-in) and lazily from every CRM entry point (self-healing for
 * workspaces that predate Sprint 10 or whose first attempt failed).
 */
export async function ensureDefaultPipeline(
  workspaceId: string,
): Promise<PipelineWithStages> {
  const existing = await findDefaultPipeline(workspaceId);
  if (existing) return existing;

  try {
    return await db.transaction(async (tx) => {
      const [pipeline] = await tx
        .insert(crmPipelines)
        .values({ workspaceId, name: DEFAULT_PIPELINE_NAME, isDefault: true })
        .returning({ id: crmPipelines.id, name: crmPipelines.name, isDefault: crmPipelines.isDefault });

      const stageRows = await tx
        .insert(crmStages)
        .values(
          DEFAULT_STAGES.map((s) => ({
            workspaceId,
            pipelineId: pipeline!.id,
            name: s.name,
            position: s.position,
            probabilityPercent: s.probabilityPercent,
            tone: s.tone,
            isWon: s.isWon,
            isLost: s.isLost,
            isProtected: s.isProtected,
          })),
        )
        .returning(STAGE_COLUMNS);

      return {
        ...pipeline!,
        stages: stageRows.sort((a, b) => a.position - b.position),
      };
    });
  } catch {
    // A concurrent request won the unique-default-pipeline race — read what it created.
    const retried = await findDefaultPipeline(workspaceId);
    if (retried) return retried;
    throw new Error("Could not provision the default pipeline.");
  }
}

export async function listPipelines(workspaceId: string): Promise<PipelineDto[]> {
  return db
    .select({ id: crmPipelines.id, name: crmPipelines.name, isDefault: crmPipelines.isDefault })
    .from(crmPipelines)
    .where(and(eq(crmPipelines.workspaceId, workspaceId), isNull(crmPipelines.deletedAt)))
    .orderBy(asc(crmPipelines.createdAt));
}

export async function getPipelineWithStages(
  workspaceId: string,
  pipelineId: string,
): Promise<PipelineWithStages> {
  const rows = await db
    .select({ id: crmPipelines.id, name: crmPipelines.name, isDefault: crmPipelines.isDefault })
    .from(crmPipelines)
    .where(
      and(
        eq(crmPipelines.id, pipelineId),
        eq(crmPipelines.workspaceId, workspaceId),
        isNull(crmPipelines.deletedAt),
      ),
    );
  const pipeline = rows[0];
  if (!pipeline) throw new Error("Pipeline not found.");
  return { ...pipeline, stages: await loadStages(workspaceId, pipelineId) };
}

/** Owner/manager (checked by the caller) — starts with its own copy of the 7 default stages, unprotected so they're freely editable. */
export async function createPipeline(
  workspaceId: string,
  input: CreatePipelineInput,
): Promise<PipelineWithStages> {
  return db.transaction(async (tx) => {
    const [pipeline] = await tx
      .insert(crmPipelines)
      .values({ workspaceId, name: input.name, isDefault: false })
      .returning({ id: crmPipelines.id, name: crmPipelines.name, isDefault: crmPipelines.isDefault });

    const stageRows = await tx
      .insert(crmStages)
      .values(
        DEFAULT_STAGES.map((s) => ({
          workspaceId,
          pipelineId: pipeline!.id,
          name: s.name,
          position: s.position,
          probabilityPercent: s.probabilityPercent,
          tone: s.tone,
          isWon: s.isWon,
          isLost: s.isLost,
          isProtected: false,
        })),
      )
      .returning(STAGE_COLUMNS);

    return { ...pipeline!, stages: stageRows.sort((a, b) => a.position - b.position) };
  });
}

/** Owner-only (checked by the caller). Blocked if it's the default pipeline or still has open opportunities. */
export async function deletePipeline(workspaceId: string, pipelineId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ isDefault: crmPipelines.isDefault })
      .from(crmPipelines)
      .where(
        and(
          eq(crmPipelines.id, pipelineId),
          eq(crmPipelines.workspaceId, workspaceId),
          isNull(crmPipelines.deletedAt),
        ),
      );
    const pipeline = rows[0];
    if (!pipeline) throw new Error("Pipeline not found.");
    if (pipeline.isDefault) throw new Error("The default pipeline can't be deleted.");

    const openCount = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(crmOpportunities)
      .where(
        and(
          eq(crmOpportunities.pipelineId, pipelineId),
          eq(crmOpportunities.status, "open"),
          isNull(crmOpportunities.deletedAt),
        ),
      );
    if ((openCount[0]?.count ?? 0) > 0) {
      throw new Error("Move or close this pipeline's open opportunities before deleting it.");
    }

    await tx
      .update(crmPipelines)
      .set({ deletedAt: new Date() })
      .where(eq(crmPipelines.id, pipelineId));
    await tx
      .update(crmStages)
      .set({ deletedAt: new Date() })
      .where(and(eq(crmStages.pipelineId, pipelineId), isNull(crmStages.deletedAt)));
  });
}

/** Appends a new stage at the end of the pipeline. Role gate (`assertManagerOrOwnerRole`) is enforced by the caller. */
export async function createStage(
  workspaceId: string,
  pipelineId: string,
  input: CreateStageInput,
): Promise<StageDto> {
  const existing = await loadStages(workspaceId, pipelineId);
  const nextPosition = existing.length === 0 ? 0 : Math.max(...existing.map((s) => s.position)) + 1;

  const rows = await db
    .insert(crmStages)
    .values({
      workspaceId,
      pipelineId,
      name: input.name,
      position: nextPosition,
      probabilityPercent: input.probabilityPercent,
      tone: input.tone,
      isWon: false,
      isLost: false,
      isProtected: false,
    })
    .returning(STAGE_COLUMNS);
  return rows[0]!;
}

/**
 * Renames/recolors a stage. `assertCanMutateStage` is enforced here (not the
 * action layer) because it depends on the stage's own `isProtected` flag,
 * which only this query has loaded — the same data-dependent-check pattern
 * `team.service.ts` uses for `assertNotLastOwner`.
 */
export async function updateStage(
  workspaceId: string,
  stageId: string,
  input: UpdateStageInput,
  actor: { role: string },
): Promise<StageDto> {
  const rows = await db
    .select(STAGE_COLUMNS)
    .from(crmStages)
    .where(
      and(
        eq(crmStages.id, stageId),
        eq(crmStages.workspaceId, workspaceId),
        isNull(crmStages.deletedAt),
      ),
    );
  const stage = rows[0];
  if (!stage) throw new Error("Stage not found.");
  assertCanMutateStage(actor.role, stage.isProtected);

  const updated = await db
    .update(crmStages)
    .set({ name: input.name, probabilityPercent: input.probabilityPercent, tone: input.tone })
    .where(eq(crmStages.id, stageId))
    .returning(STAGE_COLUMNS);
  return updated[0]!;
}

/** Deletes a stage. Blocked if it still has any (non-deleted) opportunities — move them first. */
export async function deleteStage(
  workspaceId: string,
  stageId: string,
  actor: { role: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select(STAGE_COLUMNS)
      .from(crmStages)
      .where(
        and(
          eq(crmStages.id, stageId),
          eq(crmStages.workspaceId, workspaceId),
          isNull(crmStages.deletedAt),
        ),
      );
    const stage = rows[0];
    if (!stage) throw new Error("Stage not found.");
    assertCanMutateStage(actor.role, stage.isProtected);

    const remaining = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(crmStages)
      .where(
        and(
          eq(crmStages.pipelineId, stage.pipelineId),
          isNull(crmStages.deletedAt),
        ),
      );
    if ((remaining[0]?.count ?? 0) <= 1) {
      throw new Error("A pipeline must keep at least one stage.");
    }

    const inUse = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(crmOpportunities)
      .where(and(eq(crmOpportunities.stageId, stageId), isNull(crmOpportunities.deletedAt)));
    if ((inUse[0]?.count ?? 0) > 0) {
      throw new Error("Move this stage's opportunities elsewhere before deleting it.");
    }

    await tx.update(crmStages).set({ deletedAt: new Date() }).where(eq(crmStages.id, stageId));
  });
}

/** Owner/manager (checked by the caller). Reorders in place — never adds/removes stages (enforced by `isValidStageReorder`). */
export async function reorderPipelineStages(
  workspaceId: string,
  pipelineId: string,
  stageIds: string[],
): Promise<StageDto[]> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select(STAGE_COLUMNS)
      .from(crmStages)
      .where(
        and(
          eq(crmStages.workspaceId, workspaceId),
          eq(crmStages.pipelineId, pipelineId),
          isNull(crmStages.deletedAt),
        ),
      );
    if (!isValidStageReorder(existing.map((s) => s.id), stageIds)) {
      throw new Error("Reorder must include exactly the pipeline's current stages.");
    }

    await Promise.all(
      stageIds.map((id, position) =>
        tx.update(crmStages).set({ position }).where(eq(crmStages.id, id)),
      ),
    );

    return loadStages(workspaceId, pipelineId);
  });
}

/** Whether a workspace already has its default pipeline (used to decide whether provisioning is still needed). */
export async function hasDefaultPipeline(workspaceId: string): Promise<boolean> {
  return (await findDefaultPipeline(workspaceId)) !== null;
}
