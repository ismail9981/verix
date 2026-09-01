import "server-only";

import type { IdentityTransaction } from "../auth/identity";
import type { ActivePlatformAdminContext } from "../auth/platform-authorize";
import { db } from "../db/db";
import {
  writePlatformAuditEventInTransaction,
  type PlatformAuditMetadata,
  type PlatformDomainAuditAction,
} from "./platform-audit.service";
import {
  assertPlatformWorkspaceMutation,
  type PlatformWorkspaceMutation,
} from "./platform-workspace.service";

const OPERATION_ACTION = Object.freeze({
  create: "workspace.created",
  assign_owner: "workspace.owner_assigned",
  suspend: "workspace.suspended",
  activate: "workspace.activated",
}) satisfies Readonly<
  Record<PlatformWorkspaceMutation, PlatformDomainAuditAction>
>;

export interface PlatformMutationAuditProof {
  readonly targetWorkspaceId: string;
  readonly requestId: string;
  readonly idempotencyKey?: string;
  readonly requestFingerprint?: string;
  readonly metadata?: PlatformAuditMetadata;
}

interface CompletedPlatformMutation<T> {
  readonly result: T;
  readonly audit: PlatformMutationAuditProof;
}

/**
 * Reusable atomic contract for future operation-specific services. Validation
 * remains outside this helper and before the transaction. The callback is
 * server code—not client data—and cannot choose SQL/table/capability strings.
 */
export async function executeAuditedPlatformWorkspaceMutation<T>(
  context: ActivePlatformAdminContext,
  operation: PlatformWorkspaceMutation,
  mutate: (tx: IdentityTransaction) => Promise<CompletedPlatformMutation<T>>,
): Promise<T> {
  assertPlatformWorkspaceMutation(context, operation);
  return db.transaction(async (tx) => {
    const completed = await mutate(tx);
    await writePlatformAuditEventInTransaction(tx, context, {
      action: OPERATION_ACTION[operation],
      targetWorkspaceId: completed.audit.targetWorkspaceId,
      outcome: "success",
      requestId: completed.audit.requestId,
      idempotencyKey: completed.audit.idempotencyKey,
      requestFingerprint: completed.audit.requestFingerprint,
      metadata: completed.audit.metadata,
    });
    return completed.result;
  });
}
