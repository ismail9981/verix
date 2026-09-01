import "server-only";

import { desc } from "drizzle-orm";
import type { IdentityTransaction } from "../auth/identity";
import {
  assertPlatformCapability,
  type ActivePlatformAdminContext,
} from "../auth/platform-authorize";
import type { PlatformCapability } from "../auth/platform-capabilities";
import { db } from "../db/db";
import { platformAuditEvents } from "../db/schema";
import { PlatformServiceError } from "./platform-errors";

export const PLATFORM_DOMAIN_AUDIT_ACTIONS = [
  "workspace.created",
  "workspace.owner_assigned",
  "workspace.suspended",
  "workspace.activated",
] as const;

export type PlatformDomainAuditAction =
  (typeof PLATFORM_DOMAIN_AUDIT_ACTIONS)[number];
export type PlatformAuditOutcome = "success" | "failure";

export interface PlatformAuditMetadata {
  readonly reason?: string;
  readonly note?: string;
  readonly previousStatus?: "active" | "suspended";
  readonly newStatus?: "active" | "suspended";
  readonly noOp?: boolean;
  readonly errorCode?: string;
  readonly ownerUserId?: string;
}

export interface PlatformAuditWriteInput {
  readonly action: PlatformDomainAuditAction;
  readonly targetWorkspaceId: string;
  readonly outcome: PlatformAuditOutcome;
  readonly requestId: string;
  readonly idempotencyKey?: string;
  readonly requestFingerprint?: string;
  readonly metadata?: PlatformAuditMetadata;
}

export interface PlatformAuditSummary {
  readonly id: string;
  readonly action: PlatformDomainAuditAction;
  readonly targetWorkspaceId: string | null;
  readonly outcome: PlatformAuditOutcome;
  readonly occurredAt: string;
}

const ACTION_CAPABILITY = Object.freeze({
  "workspace.created": "platform.workspaces.create",
  "workspace.owner_assigned": "platform.workspaces.assign_owner",
  "workspace.suspended": "platform.workspaces.suspend",
  "workspace.activated": "platform.workspaces.activate",
}) satisfies Readonly<Record<PlatformDomainAuditAction, PlatformCapability>>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;
const METADATA_KEYS = new Set<keyof PlatformAuditMetadata>([
  "reason",
  "note",
  "previousStatus",
  "newStatus",
  "noOp",
  "errorCode",
  "ownerUserId",
]);

function isDomainAction(value: string): value is PlatformDomainAuditAction {
  return (PLATFORM_DOMAIN_AUDIT_ACTIONS as readonly string[]).includes(value);
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function validMetadata(value: PlatformAuditMetadata): boolean {
  const entries = Object.entries(value);
  if (entries.length > METADATA_KEYS.size) return false;
  for (const [key, entry] of entries) {
    if (!METADATA_KEYS.has(key as keyof PlatformAuditMetadata)) return false;
    if (key === "noOp" && typeof entry !== "boolean") return false;
    if (
      (key === "previousStatus" || key === "newStatus") &&
      entry !== "active" &&
      entry !== "suspended"
    ) {
      return false;
    }
    if (key === "ownerUserId" && !UUID_PATTERN.test(String(entry)))
      return false;
    if (
      key !== "noOp" &&
      key !== "previousStatus" &&
      key !== "newStatus" &&
      key !== "ownerUserId" &&
      (typeof entry !== "string" || entry.length === 0 || entry.length > 512)
    ) {
      return false;
    }
  }
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= 8192;
  } catch {
    return false;
  }
}

function validateAuditInput(input: PlatformAuditWriteInput): void {
  const hasIdempotencyKey = input.idempotencyKey !== undefined;
  const hasFingerprint = input.requestFingerprint !== undefined;
  if (
    !isDomainAction(input.action) ||
    !UUID_PATTERN.test(input.targetWorkspaceId) ||
    (input.outcome !== "success" && input.outcome !== "failure") ||
    input.requestId.length < 1 ||
    input.requestId.length > 128 ||
    hasControlCharacter(input.requestId) ||
    hasIdempotencyKey !== hasFingerprint ||
    (hasIdempotencyKey && !UUID_PATTERN.test(input.idempotencyKey!)) ||
    (hasFingerprint && !FINGERPRINT_PATTERN.test(input.requestFingerprint!)) ||
    !validMetadata(input.metadata ?? {})
  ) {
    throw new PlatformServiceError("INVALID_INPUT");
  }
}

/** Safe, capped C3 proof for the future Platform Audit read surface. */
export async function readPlatformAuditSummaries(
  context: ActivePlatformAdminContext,
): Promise<readonly PlatformAuditSummary[]> {
  assertPlatformCapability(context, "platform.audit.read");
  const rows = await db
    .select({
      id: platformAuditEvents.id,
      action: platformAuditEvents.action,
      targetWorkspaceId: platformAuditEvents.targetId,
      outcome: platformAuditEvents.outcome,
      occurredAt: platformAuditEvents.occurredAt,
    })
    .from(platformAuditEvents)
    .orderBy(desc(platformAuditEvents.occurredAt))
    .limit(50);

  return Object.freeze(
    rows
      .filter((row) => isDomainAction(row.action))
      .map((row) =>
        Object.freeze({
          id: row.id,
          action: row.action as PlatformDomainAuditAction,
          targetWorkspaceId: row.targetWorkspaceId,
          outcome: row.outcome,
          occurredAt: row.occurredAt.toISOString(),
        }),
      ),
  );
}

/**
 * Internal transaction-scoped writer. Actor fields are always derived from a
 * runtime-trusted C1 context, and each action reasserts its exact capability.
 */
export async function writePlatformAuditEventInTransaction(
  tx: IdentityTransaction,
  context: ActivePlatformAdminContext,
  input: PlatformAuditWriteInput,
): Promise<string> {
  validateAuditInput(input);
  assertPlatformCapability(context, ACTION_CAPABILITY[input.action]);
  const inserted = await tx
    .insert(platformAuditEvents)
    .values({
      actorKind: "platform_admin",
      actorPlatformAdminId: context.platformAdminId,
      actorAuthUserId: context.authUserId,
      action: input.action,
      targetType: "workspace",
      targetId: input.targetWorkspaceId,
      outcome: input.outcome,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      metadata: input.metadata ?? {},
    })
    .returning({ id: platformAuditEvents.id });
  const eventId = inserted[0]?.id;
  if (!eventId) throw new PlatformServiceError("INTERNAL");
  return eventId;
}
