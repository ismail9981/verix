import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { crmActivities, crmOpportunities, users } from "../db/schema";
import { assertCanAccessOpportunity } from "../auth/rbac";
import {
  isActivityOverdue,
  type CreateActivityInput,
  type CrmActivityType,
  type UpdateActivityInput,
} from "../validators/crm-activity";

/*
 * Activity/follow-up service. Every read/write first loads the parent
 * opportunity's `assignedToUserId` and runs it through
 * `assertCanAccessOpportunity` — an employee's visibility restriction to
 * "their own assigned opportunities" applies to the opportunity's activity
 * timeline too, not just the Kanban list (see `crm-opportunity.service.ts`'s
 * header comment for the same rule).
 */

export interface ActivityActor {
  userId: string;
  role: string;
}

export interface ActivityDto {
  id: string;
  opportunityId: string;
  actorUserId: string | null;
  actorName: string | null;
  type: CrmActivityType;
  title: string;
  body: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  overdue: boolean;
  createdAt: Date;
}

const ACTIVITY_COLUMNS = {
  id: crmActivities.id,
  opportunityId: crmActivities.opportunityId,
  actorUserId: crmActivities.actorUserId,
  actorFullName: users.fullName,
  actorEmail: users.email,
  type: crmActivities.type,
  title: crmActivities.title,
  body: crmActivities.body,
  dueAt: crmActivities.dueAt,
  completedAt: crmActivities.completedAt,
  createdAt: crmActivities.createdAt,
};

type RawRow = {
  id: string;
  opportunityId: string;
  actorUserId: string | null;
  actorFullName: string | null;
  actorEmail: string | null;
  type: CrmActivityType;
  title: string;
  body: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

function toDto(row: RawRow): ActivityDto {
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    actorUserId: row.actorUserId,
    actorName: row.actorUserId ? row.actorFullName?.trim() || row.actorEmail : null,
    type: row.type,
    title: row.title,
    body: row.body,
    dueAt: row.dueAt,
    completedAt: row.completedAt,
    overdue: isActivityOverdue({ dueAt: row.dueAt, completedAt: row.completedAt }),
    createdAt: row.createdAt,
  };
}

/** Loads the opportunity's assignee and enforces the actor's access to it. Throws if not found or not permitted. */
async function assertOpportunityAccess(
  workspaceId: string,
  opportunityId: string,
  actor: ActivityActor,
): Promise<void> {
  const rows = await db
    .select({ assignedToUserId: crmOpportunities.assignedToUserId })
    .from(crmOpportunities)
    .where(
      and(
        eq(crmOpportunities.id, opportunityId),
        eq(crmOpportunities.workspaceId, workspaceId),
        isNull(crmOpportunities.deletedAt),
      ),
    );
  const opportunity = rows[0];
  if (!opportunity) throw new Error("Opportunity not found.");
  assertCanAccessOpportunity({
    role: actor.role,
    actorUserId: actor.userId,
    assignedToUserId: opportunity.assignedToUserId,
  });
}

export async function listOpportunityActivities(
  workspaceId: string,
  opportunityId: string,
  actor: ActivityActor,
): Promise<ActivityDto[]> {
  await assertOpportunityAccess(workspaceId, opportunityId, actor);

  const rows = await db
    .select(ACTIVITY_COLUMNS)
    .from(crmActivities)
    .leftJoin(users, eq(users.id, crmActivities.actorUserId))
    .where(
      and(
        eq(crmActivities.workspaceId, workspaceId),
        eq(crmActivities.opportunityId, opportunityId),
        isNull(crmActivities.deletedAt),
      ),
    )
    .orderBy(desc(crmActivities.createdAt));
  return rows.map(toDto);
}

export async function addActivity(
  workspaceId: string,
  opportunityId: string,
  input: CreateActivityInput,
  actor: ActivityActor,
): Promise<ActivityDto> {
  await assertOpportunityAccess(workspaceId, opportunityId, actor);

  const rows = await db
    .insert(crmActivities)
    .values({
      workspaceId,
      opportunityId,
      actorUserId: actor.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    })
    .returning({ id: crmActivities.id });

  return getActivity(workspaceId, rows[0]!.id, actor);
}

async function getActivity(
  workspaceId: string,
  id: string,
  actor: ActivityActor,
): Promise<ActivityDto> {
  const rows = await db
    .select(ACTIVITY_COLUMNS)
    .from(crmActivities)
    .leftJoin(users, eq(users.id, crmActivities.actorUserId))
    .where(
      and(
        eq(crmActivities.id, id),
        eq(crmActivities.workspaceId, workspaceId),
        isNull(crmActivities.deletedAt),
      ),
    );
  const row = rows[0];
  if (!row) throw new Error("Activity not found.");
  await assertOpportunityAccess(workspaceId, row.opportunityId, actor);
  return toDto(row);
}

async function loadOwnedActivity(
  workspaceId: string,
  id: string,
  actor: ActivityActor,
): Promise<{ opportunityId: string }> {
  const rows = await db
    .select({ opportunityId: crmActivities.opportunityId })
    .from(crmActivities)
    .where(
      and(
        eq(crmActivities.id, id),
        eq(crmActivities.workspaceId, workspaceId),
        isNull(crmActivities.deletedAt),
      ),
    );
  const row = rows[0];
  if (!row) throw new Error("Activity not found.");
  await assertOpportunityAccess(workspaceId, row.opportunityId, actor);
  return row;
}

export async function updateActivity(
  workspaceId: string,
  id: string,
  input: UpdateActivityInput,
  actor: ActivityActor,
): Promise<ActivityDto> {
  await loadOwnedActivity(workspaceId, id, actor);

  await db
    .update(crmActivities)
    .set({
      title: input.title,
      body: input.body ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    })
    .where(eq(crmActivities.id, id));

  return getActivity(workspaceId, id, actor);
}

export async function completeActivity(
  workspaceId: string,
  id: string,
  actor: ActivityActor,
): Promise<ActivityDto> {
  await loadOwnedActivity(workspaceId, id, actor);

  await db
    .update(crmActivities)
    .set({ completedAt: new Date() })
    .where(eq(crmActivities.id, id));

  return getActivity(workspaceId, id, actor);
}

export async function deleteActivity(
  workspaceId: string,
  id: string,
  actor: ActivityActor,
): Promise<void> {
  await loadOwnedActivity(workspaceId, id, actor);

  await db
    .update(crmActivities)
    .set({ deletedAt: new Date() })
    .where(eq(crmActivities.id, id));
}
