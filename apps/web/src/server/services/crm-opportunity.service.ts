import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNull,
  type ExtractTablesWithRelations,
} from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { db } from "../db/db";
import { hasCapability } from "../auth/capabilities";
import {
  crmActivities,
  crmOpportunities,
  crmPipelines,
  crmStages,
  customers,
  leads,
  teamMembers,
  users,
} from "../db/schema";
import { assertCanAccessOpportunity } from "../auth/rbac";
import {
  DUPLICATE_LEAD_OPPORTUNITY_ERROR,
  deriveStatusForStage,
  findOpenOpportunityForLead,
  isStageInPipeline,
  resolveOpportunityScope,
  weightedValueCents,
  type CreateOpportunityInput,
  type CrmOpportunityStatus,
  type MarkOpportunityLostInput,
  type OpportunityFilters,
  type UpdateOpportunityInput,
} from "../validators/crm-pipeline";

/*
 * Opportunity service — the sales-pipeline core. Every query is scoped to
 * `workspaceId` and excludes soft-deleted rows. On top of tenant isolation,
 * every read/write also applies the actor's *role scope*
 * (`resolveOpportunityScope`/`assertCanAccessOpportunity`): an employee only
 * ever sees or touches opportunities assigned to them — enforced here, not in
 * the UI, so an optimistic client update can never bypass it.
 *
 * Status is never set independently — moving an opportunity to a stage
 * derives `status` from that stage's `isWon`/`isLost` flags
 * (`deriveStatusForStage`), so "won/lost" can't drift from the board.
 */

type Schema = typeof import("../db/schema");
type Executor = PgDatabase<
  PostgresJsQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

export interface OpportunityActor {
  userId: string;
  role: string;
}

export interface OpportunityListItem {
  id: string;
  pipelineId: string;
  stageId: string;
  stageName: string;
  stageIsWon: boolean;
  stageIsLost: boolean;
  leadId: string | null;
  customerId: string | null;
  customerName: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  title: string;
  valueCents: number;
  weightedValueCents: number;
  currency: string;
  status: CrmOpportunityStatus;
  lossReason: string | null;
  expectedCloseDate: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RAW_COLUMNS = {
  id: crmOpportunities.id,
  pipelineId: crmOpportunities.pipelineId,
  stageId: crmOpportunities.stageId,
  stageName: crmStages.name,
  stageIsWon: crmStages.isWon,
  stageIsLost: crmStages.isLost,
  stageProbability: crmStages.probabilityPercent,
  leadId: crmOpportunities.leadId,
  customerId: crmOpportunities.customerId,
  customerName: customers.name,
  assignedToUserId: crmOpportunities.assignedToUserId,
  assignedFullName: users.fullName,
  assignedEmail: users.email,
  title: crmOpportunities.title,
  valueCents: crmOpportunities.valueCents,
  currency: crmOpportunities.currency,
  status: crmOpportunities.status,
  lossReason: crmOpportunities.lossReason,
  expectedCloseDate: crmOpportunities.expectedCloseDate,
  closedAt: crmOpportunities.closedAt,
  archivedAt: crmOpportunities.archivedAt,
  createdAt: crmOpportunities.createdAt,
  updatedAt: crmOpportunities.updatedAt,
};

type RawRow = {
  id: string;
  pipelineId: string;
  stageId: string;
  stageName: string;
  stageIsWon: boolean;
  stageIsLost: boolean;
  stageProbability: number;
  leadId: string | null;
  customerId: string | null;
  customerName: string | null;
  assignedToUserId: string | null;
  assignedFullName: string | null;
  assignedEmail: string | null;
  title: string;
  valueCents: number;
  currency: string;
  status: CrmOpportunityStatus;
  lossReason: string | null;
  expectedCloseDate: Date | null;
  closedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toListItem(row: RawRow): OpportunityListItem {
  return {
    id: row.id,
    pipelineId: row.pipelineId,
    stageId: row.stageId,
    stageName: row.stageName,
    stageIsWon: row.stageIsWon,
    stageIsLost: row.stageIsLost,
    leadId: row.leadId,
    customerId: row.customerId,
    customerName: row.customerName,
    assignedToUserId: row.assignedToUserId,
    assignedToName: row.assignedFullName?.trim() || row.assignedEmail,
    title: row.title,
    valueCents: row.valueCents,
    weightedValueCents: weightedValueCents(
      row.valueCents,
      row.stageProbability,
    ),
    currency: row.currency,
    status: row.status,
    lossReason: row.lossReason,
    expectedCloseDate: row.expectedCloseDate,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function baseQuery(exec: Executor) {
  return exec
    .select(RAW_COLUMNS)
    .from(crmOpportunities)
    .innerJoin(crmStages, eq(crmStages.id, crmOpportunities.stageId))
    .leftJoin(customers, eq(customers.id, crmOpportunities.customerId))
    .leftJoin(users, eq(users.id, crmOpportunities.assignedToUserId));
}

async function assertActiveMember(
  exec: Executor,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const rows = await exec
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.workspaceId, workspaceId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, "active"),
        isNull(teamMembers.deletedAt),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    throw new Error("Assignee is not an active member of this workspace.");
  }
}

async function getRow(
  exec: Executor,
  workspaceId: string,
  id: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<OpportunityListItem> {
  const where = [
    eq(crmOpportunities.id, id),
    eq(crmOpportunities.workspaceId, workspaceId),
    isNull(crmOpportunities.deletedAt),
  ];
  if (!includeArchived) where.push(isNull(crmOpportunities.archivedAt));

  const rows = await baseQuery(exec).where(and(...where));
  const row = rows[0];
  if (!row) throw new Error("Opportunity not found.");
  return toListItem(row);
}

export async function listOpportunities(
  workspaceId: string,
  actor: OpportunityActor,
  filters: OpportunityFilters,
): Promise<OpportunityListItem[]> {
  const scope = resolveOpportunityScope(actor.role, actor.userId);
  const where = [
    eq(crmOpportunities.workspaceId, workspaceId),
    isNull(crmOpportunities.deletedAt),
    isNull(crmOpportunities.archivedAt),
  ];
  if (scope.kind === "assigned") {
    where.push(eq(crmOpportunities.assignedToUserId, scope.userId));
  }
  if (filters.status !== "all")
    where.push(eq(crmOpportunities.status, filters.status));
  if (filters.pipelineId)
    where.push(eq(crmOpportunities.pipelineId, filters.pipelineId));
  if (filters.assignedToUserId) {
    where.push(eq(crmOpportunities.assignedToUserId, filters.assignedToUserId));
  }
  if (filters.search) {
    where.push(ilike(crmOpportunities.title, `%${filters.search}%`));
  }

  const rows = await baseQuery(db)
    .where(and(...where))
    .orderBy(asc(crmStages.position), desc(crmOpportunities.createdAt));
  return rows.map(toListItem);
}

export async function getOpportunity(
  workspaceId: string,
  id: string,
  actor: OpportunityActor,
): Promise<OpportunityListItem> {
  const row = await getRow(db, workspaceId, id, { includeArchived: true });
  assertCanAccessOpportunity({
    role: actor.role,
    actorUserId: actor.userId,
    assignedToUserId: row.assignedToUserId,
  });
  return row;
}

export async function createOpportunity(
  workspaceId: string,
  input: CreateOpportunityInput,
  actor: OpportunityActor,
): Promise<OpportunityListItem> {
  return db.transaction(async (tx) => {
    const pipelineRows = await tx
      .select({ id: crmPipelines.id })
      .from(crmPipelines)
      .where(
        and(
          eq(crmPipelines.id, input.pipelineId),
          eq(crmPipelines.workspaceId, workspaceId),
          isNull(crmPipelines.deletedAt),
        ),
      );
    if (!pipelineRows[0]) throw new Error("Pipeline not found.");

    let stageId = input.stageId;
    if (stageId) {
      const stageRows = await tx
        .select({ id: crmStages.id, pipelineId: crmStages.pipelineId })
        .from(crmStages)
        .where(
          and(
            eq(crmStages.id, stageId),
            eq(crmStages.workspaceId, workspaceId),
            isNull(crmStages.deletedAt),
          ),
        );
      const stage = stageRows[0];
      if (!stage || !isStageInPipeline(stage, input.pipelineId)) {
        throw new Error("Stage does not belong to this pipeline.");
      }
    } else {
      const firstStage = await tx
        .select({ id: crmStages.id })
        .from(crmStages)
        .where(
          and(
            eq(crmStages.pipelineId, input.pipelineId),
            isNull(crmStages.deletedAt),
          ),
        )
        .orderBy(asc(crmStages.position))
        .limit(1);
      if (!firstStage[0]) throw new Error("This pipeline has no stages.");
      stageId = firstStage[0].id;
    }

    if (input.leadId) {
      const lead = await tx
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.id, input.leadId),
            eq(leads.workspaceId, workspaceId),
            isNull(leads.deletedAt),
          ),
        );
      if (!lead[0]) throw new Error("Lead not found.");

      const openForLead = await tx
        .select({
          id: crmOpportunities.id,
          leadId: crmOpportunities.leadId,
          status: crmOpportunities.status,
        })
        .from(crmOpportunities)
        .where(
          and(
            eq(crmOpportunities.workspaceId, workspaceId),
            eq(crmOpportunities.leadId, input.leadId),
            isNull(crmOpportunities.deletedAt),
            isNull(crmOpportunities.archivedAt),
          ),
        );
      if (findOpenOpportunityForLead(openForLead, input.leadId)) {
        throw new Error(DUPLICATE_LEAD_OPPORTUNITY_ERROR);
      }
    }

    if (input.customerId) {
      const customer = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.id, input.customerId),
            eq(customers.workspaceId, workspaceId),
            isNull(customers.deletedAt),
          ),
        );
      if (!customer[0]) throw new Error("Customer not found.");
    }

    let assignedToUserId = input.assignedToUserId ?? null;
    if (!hasCapability(actor, "crm.pipeline.manage")) {
      if (assignedToUserId && assignedToUserId !== actor.userId) {
        throw new Error("You can only assign opportunities to yourself.");
      }
      assignedToUserId = actor.userId;
    } else if (assignedToUserId) {
      await assertActiveMember(tx, workspaceId, assignedToUserId);
    }

    const inserted = await tx
      .insert(crmOpportunities)
      .values({
        workspaceId,
        pipelineId: input.pipelineId,
        stageId,
        leadId: input.leadId ?? null,
        customerId: input.customerId ?? null,
        assignedToUserId,
        title: input.title,
        valueCents: input.valueCents,
        expectedCloseDate: input.expectedCloseDate
          ? new Date(input.expectedCloseDate)
          : null,
      })
      .returning({ id: crmOpportunities.id });

    return getRow(tx, workspaceId, inserted[0]!.id);
  });
}

export async function updateOpportunity(
  workspaceId: string,
  id: string,
  input: UpdateOpportunityInput,
  actor: OpportunityActor,
): Promise<OpportunityListItem> {
  return db.transaction(async (tx) => {
    const current = await tx
      .select({ assignedToUserId: crmOpportunities.assignedToUserId })
      .from(crmOpportunities)
      .where(
        and(
          eq(crmOpportunities.id, id),
          eq(crmOpportunities.workspaceId, workspaceId),
          isNull(crmOpportunities.deletedAt),
        ),
      );
    const row = current[0];
    if (!row) throw new Error("Opportunity not found.");
    assertCanAccessOpportunity({
      role: actor.role,
      actorUserId: actor.userId,
      assignedToUserId: row.assignedToUserId,
    });

    let assignedToUserId = row.assignedToUserId;
    if (
      input.assignedToUserId !== undefined &&
      input.assignedToUserId !== row.assignedToUserId
    ) {
      if (!hasCapability(actor, "crm.pipeline.manage")) {
        throw new Error(
          "Only owners and managers can reassign an opportunity.",
        );
      }
      await assertActiveMember(tx, workspaceId, input.assignedToUserId);
      assignedToUserId = input.assignedToUserId;
    }

    await tx
      .update(crmOpportunities)
      .set({
        title: input.title,
        valueCents: input.valueCents,
        expectedCloseDate: input.expectedCloseDate
          ? new Date(input.expectedCloseDate)
          : null,
        assignedToUserId,
      })
      .where(eq(crmOpportunities.id, id));

    return getRow(tx, workspaceId, id);
  });
}

/** Shared core for move/won/lost: verifies the stage, derives status, stamps closedAt, and logs a status_change activity — all in one transaction. */
async function applyStageMove(
  workspaceId: string,
  id: string,
  stageId: string,
  actor: OpportunityActor,
  lossReason?: string | null,
): Promise<OpportunityListItem> {
  return db.transaction(async (tx) => {
    const oppRows = await tx
      .select({
        pipelineId: crmOpportunities.pipelineId,
        assignedToUserId: crmOpportunities.assignedToUserId,
        stageId: crmOpportunities.stageId,
      })
      .from(crmOpportunities)
      .where(
        and(
          eq(crmOpportunities.id, id),
          eq(crmOpportunities.workspaceId, workspaceId),
          isNull(crmOpportunities.deletedAt),
        ),
      );
    const opportunity = oppRows[0];
    if (!opportunity) throw new Error("Opportunity not found.");
    assertCanAccessOpportunity({
      role: actor.role,
      actorUserId: actor.userId,
      assignedToUserId: opportunity.assignedToUserId,
    });

    const stageRows = await tx
      .select({
        id: crmStages.id,
        name: crmStages.name,
        pipelineId: crmStages.pipelineId,
        isWon: crmStages.isWon,
        isLost: crmStages.isLost,
      })
      .from(crmStages)
      .where(
        and(
          eq(crmStages.id, stageId),
          eq(crmStages.workspaceId, workspaceId),
          isNull(crmStages.deletedAt),
        ),
      );
    const stage = stageRows[0];
    if (!stage || !isStageInPipeline(stage, opportunity.pipelineId)) {
      throw new Error("Stage does not belong to this opportunity's pipeline.");
    }

    const nextStatus = deriveStatusForStage(stage);
    const isNoop = stage.id === opportunity.stageId;

    await tx
      .update(crmOpportunities)
      .set({
        stageId: stage.id,
        status: nextStatus,
        closedAt: nextStatus === "open" ? null : new Date(),
        lossReason: nextStatus === "lost" ? (lossReason ?? null) : null,
      })
      .where(eq(crmOpportunities.id, id));

    if (!isNoop) {
      await tx.insert(crmActivities).values({
        workspaceId,
        opportunityId: id,
        actorUserId: actor.userId,
        type: "status_change",
        title: `Moved to ${stage.name}`,
      });
    }

    return getRow(tx, workspaceId, id, { includeArchived: true });
  });
}

export async function moveOpportunityToStage(
  workspaceId: string,
  id: string,
  stageId: string,
  actor: OpportunityActor,
): Promise<OpportunityListItem> {
  return applyStageMove(workspaceId, id, stageId, actor);
}

export async function markOpportunityWon(
  workspaceId: string,
  id: string,
  actor: OpportunityActor,
): Promise<OpportunityListItem> {
  const opp = await getOpportunity(workspaceId, id, actor);
  const wonStage = await db
    .select({ id: crmStages.id })
    .from(crmStages)
    .where(
      and(
        eq(crmStages.pipelineId, opp.pipelineId),
        eq(crmStages.isWon, true),
        isNull(crmStages.deletedAt),
      ),
    );
  if (!wonStage[0])
    throw new Error("This pipeline has no Won stage configured.");
  return applyStageMove(workspaceId, id, wonStage[0].id, actor);
}

export async function markOpportunityLost(
  workspaceId: string,
  id: string,
  input: MarkOpportunityLostInput,
  actor: OpportunityActor,
): Promise<OpportunityListItem> {
  const opp = await getOpportunity(workspaceId, id, actor);
  const lostStage = await db
    .select({ id: crmStages.id })
    .from(crmStages)
    .where(
      and(
        eq(crmStages.pipelineId, opp.pipelineId),
        eq(crmStages.isLost, true),
        isNull(crmStages.deletedAt),
      ),
    );
  if (!lostStage[0])
    throw new Error("This pipeline has no Lost stage configured.");
  return applyStageMove(
    workspaceId,
    id,
    lostStage[0].id,
    actor,
    input.lossReason ?? null,
  );
}

/** Archiving is a lifecycle flag orthogonal to status — an archived deal keeps its won/lost outcome. */
export async function archiveOpportunity(
  workspaceId: string,
  id: string,
  actor: OpportunityActor,
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ assignedToUserId: crmOpportunities.assignedToUserId })
      .from(crmOpportunities)
      .where(
        and(
          eq(crmOpportunities.id, id),
          eq(crmOpportunities.workspaceId, workspaceId),
          isNull(crmOpportunities.deletedAt),
        ),
      );
    const row = rows[0];
    if (!row) throw new Error("Opportunity not found.");
    assertCanAccessOpportunity({
      role: actor.role,
      actorUserId: actor.userId,
      assignedToUserId: row.assignedToUserId,
    });

    await tx
      .update(crmOpportunities)
      .set({ archivedAt: new Date() })
      .where(eq(crmOpportunities.id, id));
  });
}

export interface CrmMetrics {
  openCount: number;
  openValueCents: number;
  weightedValueCents: number;
  wonThisMonthCount: number;
  wonThisMonthValueCents: number;
  lostThisMonthCount: number;
  byStage: {
    stageId: string;
    stageName: string;
    count: number;
    valueCents: number;
  }[];
  overdueFollowUps: number;
  upcomingFollowUps: number;
}

export async function getPipelineMetrics(
  workspaceId: string,
  pipelineId: string,
  actor: OpportunityActor,
): Promise<CrmMetrics> {
  const scope = resolveOpportunityScope(actor.role, actor.userId);
  const scopeWhere =
    scope.kind === "assigned"
      ? [eq(crmOpportunities.assignedToUserId, scope.userId)]
      : [];

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const openRows = await db
    .select({
      stageId: crmStages.id,
      stageName: crmStages.name,
      probabilityPercent: crmStages.probabilityPercent,
      valueCents: crmOpportunities.valueCents,
    })
    .from(crmOpportunities)
    .innerJoin(crmStages, eq(crmStages.id, crmOpportunities.stageId))
    .where(
      and(
        eq(crmOpportunities.workspaceId, workspaceId),
        eq(crmOpportunities.pipelineId, pipelineId),
        eq(crmOpportunities.status, "open"),
        isNull(crmOpportunities.deletedAt),
        isNull(crmOpportunities.archivedAt),
        ...scopeWhere,
      ),
    );

  const byStageMap = new Map<
    string,
    { stageName: string; count: number; valueCents: number }
  >();
  let openValueCents = 0;
  let weightedTotalCents = 0;
  for (const r of openRows) {
    openValueCents += r.valueCents;
    weightedTotalCents += weightedValueCents(
      r.valueCents,
      r.probabilityPercent,
    );
    const bucket = byStageMap.get(r.stageId) ?? {
      stageName: r.stageName,
      count: 0,
      valueCents: 0,
    };
    bucket.count += 1;
    bucket.valueCents += r.valueCents;
    byStageMap.set(r.stageId, bucket);
  }

  const closedRows = await db
    .select({
      status: crmOpportunities.status,
      valueCents: crmOpportunities.valueCents,
      closedAt: crmOpportunities.closedAt,
    })
    .from(crmOpportunities)
    .where(
      and(
        eq(crmOpportunities.workspaceId, workspaceId),
        eq(crmOpportunities.pipelineId, pipelineId),
        isNull(crmOpportunities.deletedAt),
        ...scopeWhere,
      ),
    );

  let wonThisMonthCount = 0;
  let wonThisMonthValueCents = 0;
  let lostThisMonthCount = 0;
  for (const r of closedRows) {
    if (!r.closedAt || r.closedAt < monthStart) continue;
    if (r.status === "won") {
      wonThisMonthCount += 1;
      wonThisMonthValueCents += r.valueCents;
    } else if (r.status === "lost") {
      lostThisMonthCount += 1;
    }
  }

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const followUpRows = await db
    .select({ dueAt: crmActivities.dueAt })
    .from(crmActivities)
    .innerJoin(
      crmOpportunities,
      eq(crmOpportunities.id, crmActivities.opportunityId),
    )
    .where(
      and(
        eq(crmActivities.workspaceId, workspaceId),
        eq(crmOpportunities.pipelineId, pipelineId),
        isNull(crmActivities.deletedAt),
        isNull(crmActivities.completedAt),
        ...scopeWhere,
      ),
    );

  let overdueFollowUps = 0;
  let upcomingFollowUps = 0;
  for (const r of followUpRows) {
    if (!r.dueAt) continue;
    if (r.dueAt.getTime() < now.getTime()) overdueFollowUps += 1;
    else if (r.dueAt.getTime() <= weekAhead.getTime()) upcomingFollowUps += 1;
  }

  return {
    openCount: openRows.length,
    openValueCents,
    weightedValueCents: weightedTotalCents,
    wonThisMonthCount,
    wonThisMonthValueCents,
    lostThisMonthCount,
    byStage: [...byStageMap.entries()].map(([stageId, v]) => ({
      stageId,
      ...v,
    })),
    overdueFollowUps,
    upcomingFollowUps,
  };
}
