import { z } from "zod";
import { cleanOptional } from "./shared";

/*
 * Validation + pure decision logic for CRM opportunity activities/follow-ups
 * (Sprint 10). Dependency-free — see `crm-pipeline.ts` for the same split
 * rationale.
 */

export const CRM_ACTIVITY_TYPES = [
  "note",
  "call",
  "email",
  "meeting",
  "task",
  "status_change",
] as const;
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];

/** Types a user can log directly; `status_change` is only ever auto-created by the pipeline-move service. */
export const LOGGABLE_ACTIVITY_TYPES = [
  "note",
  "call",
  "email",
  "meeting",
  "task",
] as const;
export type LoggableActivityType = (typeof LOGGABLE_ACTIVITY_TYPES)[number];

export const createActivitySchema = z.object({
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.preprocess(cleanOptional, z.string().max(2000).optional()),
  dueAt: z.preprocess(cleanOptional, z.iso.datetime({ local: true }).optional()),
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const updateActivitySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.preprocess(cleanOptional, z.string().max(2000).optional()),
  dueAt: z.preprocess(cleanOptional, z.iso.datetime({ local: true }).optional()),
});
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

/** A follow-up is overdue when it has a due date in the past and hasn't been completed. */
export function isActivityOverdue(
  activity: { dueAt: Date | null; completedAt: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    activity.dueAt !== null && activity.completedAt === null && activity.dueAt.getTime() < now.getTime()
  );
}

/** An upcoming (not yet due) open follow-up, within `withinMs` of `now` (default 7 days). */
export function isActivityUpcoming(
  activity: { dueAt: Date | null; completedAt: Date | null },
  now: Date = new Date(),
  withinMs: number = 7 * 24 * 60 * 60 * 1000,
): boolean {
  if (activity.dueAt === null || activity.completedAt !== null) return false;
  const delta = activity.dueAt.getTime() - now.getTime();
  return delta >= 0 && delta <= withinMs;
}
