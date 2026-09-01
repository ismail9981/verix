import "server-only";

import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { db } from "../db/db";
import { platformAdmins } from "../db/schema";
import {
  isPlatformAdminRole,
  type PlatformAdminRole,
} from "./platform-capabilities";
import { getCurrentUser } from "./session";

export type PlatformAdminStatus = "active" | "suspended";

export interface PlatformAdminIdentity {
  readonly platformAdminId: string;
  readonly authUserId: string;
  readonly role: PlatformAdminRole;
  readonly status: PlatformAdminStatus;
}

export type PlatformIdentityResolution =
  | { readonly state: "UNAUTHENTICATED" }
  | { readonly state: "NOT_PLATFORM_ADMIN" }
  | {
      readonly state: "ACTIVE_PLATFORM_ADMIN";
      readonly identity: PlatformAdminIdentity & { readonly status: "active" };
    }
  | {
      readonly state: "SUSPENDED_PLATFORM_ADMIN";
      readonly identity: PlatformAdminIdentity & {
        readonly status: "suspended";
      };
    };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlatformAdminStatus(value: string): value is PlatformAdminStatus {
  return value === "active" || value === "suspended";
}

/**
 * Resolves only the immutable Supabase Auth UUID. Email, Auth metadata,
 * Workspace membership, Active Workspace, and caller-provided role claims are
 * deliberately absent from this boundary.
 */
export async function resolvePlatformIdentity(
  authIdentity: Pick<User, "id"> | null,
): Promise<PlatformIdentityResolution> {
  if (!authIdentity) return { state: "UNAUTHENTICATED" };
  if (!UUID_PATTERN.test(authIdentity.id)) {
    return { state: "NOT_PLATFORM_ADMIN" };
  }

  const row = await db.query.platformAdmins.findFirst({
    columns: {
      id: true,
      authUserId: true,
      role: true,
      status: true,
    },
    where: eq(platformAdmins.authUserId, authIdentity.id),
  });

  if (
    !row ||
    row.authUserId !== authIdentity.id ||
    !isPlatformAdminRole(row.role) ||
    !isPlatformAdminStatus(row.status)
  ) {
    return { state: "NOT_PLATFORM_ADMIN" };
  }

  const identity: PlatformAdminIdentity = Object.freeze({
    platformAdminId: row.id,
    authUserId: row.authUserId,
    role: row.role,
    status: row.status,
  });
  return row.status === "active"
    ? {
        state: "ACTIVE_PLATFORM_ADMIN",
        identity: identity as PlatformAdminIdentity & {
          readonly status: "active";
        },
      }
    : {
        state: "SUSPENDED_PLATFORM_ADMIN",
        identity: identity as PlatformAdminIdentity & {
          readonly status: "suspended";
        },
      };
}

/** One trusted Auth revalidation and Platform lookup per server request. */
export const getPlatformIdentityResolution = cache(
  async (): Promise<PlatformIdentityResolution> =>
    resolvePlatformIdentity(await getCurrentUser()),
);
