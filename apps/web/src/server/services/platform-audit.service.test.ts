import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResolution: vi.fn(),
  select: vi.fn(),
  auditRows: [] as Array<{
    id: string;
    action:
      | "workspace.created"
      | "workspace.owner_assigned"
      | "workspace.suspended"
      | "workspace.activated";
    targetWorkspaceId: string | null;
    outcome: "success" | "failure";
    occurredAt: Date;
  }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("../auth/platform-identity", () => ({
  getPlatformIdentityResolution: mocks.getResolution,
}));
vi.mock("../db/db", () => ({ db: { select: mocks.select } }));

import {
  requireActivePlatformAdmin,
  requirePlatformCapability,
} from "../auth/platform-authorize";
import {
  readPlatformAuditSummaries,
  writePlatformAuditEventInTransaction,
} from "./platform-audit.service";

const ids = {
  admin: "c3400000-0000-4000-8000-000000000001",
  auth: "c3500000-0000-4000-8000-000000000001",
  workspace: "c3600000-0000-4000-8000-000000000001",
  event: "c3700000-0000-4000-8000-000000000001",
} as const;

function active(role: "super_admin" | "support_admin") {
  return {
    state: "ACTIVE_PLATFORM_ADMIN" as const,
    identity: {
      platformAdminId: ids.admin,
      authUserId: ids.auth,
      role,
      status: "active" as const,
    },
  };
}

function fakeTransaction() {
  const returning = vi.fn().mockResolvedValue([{ id: ids.event }]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  return { tx: { insert } as never, insert, values, returning };
}

describe("C3 Platform Audit service boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auditRows = [];
    mocks.select.mockImplementation(() => ({
      from: () => ({
        orderBy: () => ({
          limit: async (limit: number) => {
            expect(limit).toBe(50);
            return mocks.auditRows;
          },
        }),
      }),
    }));
  });

  it("allows active Super Admin to read the capped safe Audit projection", async () => {
    mocks.getResolution.mockResolvedValue(active("super_admin"));
    mocks.auditRows = [
      {
        id: ids.event,
        action: "workspace.suspended",
        targetWorkspaceId: ids.workspace,
        outcome: "success",
        occurredAt: new Date("2026-08-31T09:00:00.000Z"),
      },
    ];
    const context = await requirePlatformCapability("platform.audit.read");
    await expect(readPlatformAuditSummaries(context)).resolves.toEqual([
      {
        id: ids.event,
        action: "workspace.suspended",
        targetWorkspaceId: ids.workspace,
        outcome: "success",
        occurredAt: "2026-08-31T09:00:00.000Z",
      },
    ]);
  });

  it("denies Support Admin Audit read before DB access", async () => {
    mocks.getResolution.mockResolvedValue(active("support_admin"));
    const context = await requireActivePlatformAdmin();
    await expect(readPlatformAuditSummaries(context)).rejects.toMatchObject({
      code: "PLATFORM_CAPABILITY_DENIED",
    });
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it.each(["owner", "manager", "employee"])(
    "denies forged Workspace %s Audit read and write contexts",
    async (role) => {
      const forged = {
        role,
        status: "active",
        capabilities: ["platform.audit.read", "platform.workspaces.suspend"],
      };
      await expect(
        readPlatformAuditSummaries(forged as never),
      ).rejects.toBeDefined();
      const { tx, insert } = fakeTransaction();
      await expect(
        writePlatformAuditEventInTransaction(tx, forged as never, {
          action: "workspace.suspended",
          targetWorkspaceId: ids.workspace,
          outcome: "success",
          requestId: "request-1",
          metadata: { reason: "Policy violation" },
        }),
      ).rejects.toBeDefined();
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it("derives actor identity from trusted context and ignores forged actor fields", async () => {
    mocks.getResolution.mockResolvedValue(active("super_admin"));
    const context = await requireActivePlatformAdmin();
    const { tx, values } = fakeTransaction();
    await expect(
      writePlatformAuditEventInTransaction(tx, context, {
        action: "workspace.suspended",
        targetWorkspaceId: ids.workspace,
        outcome: "success",
        requestId: "request-2",
        metadata: { reason: "Contract breach" },
        actorPlatformAdminId: "attacker" as never,
      } as never),
    ).resolves.toBe(ids.event);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorKind: "platform_admin",
        actorPlatformAdminId: ids.admin,
        actorAuthUserId: ids.auth,
        targetId: ids.workspace,
      }),
    );
  });

  it.each([
    { metadata: { token: "secret" } },
    { requestId: "bad\nrequest" },
    { idempotencyKey: ids.event },
    { requestFingerprint: "a".repeat(64) },
    { requestFingerprint: "A".repeat(64), idempotencyKey: ids.event },
  ])(
    "rejects unsafe or inconsistent Audit input before insert",
    async (override) => {
      mocks.getResolution.mockResolvedValue(active("super_admin"));
      const context = await requireActivePlatformAdmin();
      const { tx, insert } = fakeTransaction();
      await expect(
        writePlatformAuditEventInTransaction(tx, context, {
          action: "workspace.created",
          targetWorkspaceId: ids.workspace,
          outcome: "success",
          requestId: "request-3",
          ...override,
        } as never),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(insert).not.toHaveBeenCalled();
    },
  );
});
