import "server-only";

import { asc, desc, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { workspaces } from "../db/schema";
import {
  assertPlatformCapability,
  type ActivePlatformAdminContext,
} from "../auth/platform-authorize";
import type { PlatformCapability } from "../auth/platform-capabilities";
import { PlatformServiceError } from "./platform-errors";

export interface PlatformWorkspaceSummary {
  readonly id: string;
  readonly name: string;
  readonly status: "active" | "suspended";
  readonly createdAt: string;
}

export const PLATFORM_WORKSPACE_MUTATIONS = [
  "create",
  "assign_owner",
  "suspend",
  "activate",
] as const;

export type PlatformWorkspaceMutation =
  (typeof PLATFORM_WORKSPACE_MUTATIONS)[number];

const MUTATION_CAPABILITY = Object.freeze({
  create: "platform.workspaces.create",
  assign_owner: "platform.workspaces.assign_owner",
  suspend: "platform.workspaces.suspend",
  activate: "platform.workspaces.activate",
}) satisfies Readonly<Record<PlatformWorkspaceMutation, PlatformCapability>>;

function isPlatformWorkspaceMutation(
  operation: string,
): operation is PlatformWorkspaceMutation {
  return (PLATFORM_WORKSPACE_MUTATIONS as readonly string[]).includes(
    operation,
  );
}

/**
 * Operation vocabulary is server-owned. This assertion performs no query and
 * accepts no target, SQL, table, role, or caller-provided capability.
 */
export function assertPlatformWorkspaceMutation(
  context: unknown,
  operation: PlatformWorkspaceMutation,
): asserts context is ActivePlatformAdminContext {
  if (!isPlatformWorkspaceMutation(operation)) {
    throw new PlatformServiceError("INVALID_INPUT");
  }
  assertPlatformCapability(context, MUTATION_CAPABILITY[operation]);
}

/**
 * C3 read proof only. It is intentionally capped and exposes no owner,
 * contact, billing, membership, or tenant-domain fields.
 */
export async function readPlatformWorkspaceSummaries(
  context: ActivePlatformAdminContext,
): Promise<readonly PlatformWorkspaceSummary[]> {
  assertPlatformCapability(context, "platform.workspaces.read");
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      status: workspaces.status,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .where(isNull(workspaces.deletedAt))
    .orderBy(desc(workspaces.createdAt), asc(workspaces.id))
    .limit(100);

  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        id: row.id,
        name: row.name,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      }),
    ),
  );
}
