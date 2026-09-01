import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResolution: vi.fn(),
  transaction: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../auth/platform-identity", () => ({
  getPlatformIdentityResolution: mocks.getResolution,
}));
vi.mock("../db/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("./platform-audit.service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./platform-audit.service")>();
  return {
    ...original,
    writePlatformAuditEventInTransaction: mocks.writeAudit,
  };
});

import { requireActivePlatformAdmin } from "../auth/platform-authorize";
import { executeAuditedPlatformWorkspaceMutation } from "./platform-mutation";

const ids = {
  admin: "c3800000-0000-4000-8000-000000000001",
  auth: "c3900000-0000-4000-8000-000000000001",
  workspace: "c3a00000-0000-4000-8000-000000000001",
} as const;

describe("C3 audited Platform mutation transaction contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getResolution.mockResolvedValue({
      state: "ACTIVE_PLATFORM_ADMIN",
      identity: {
        platformAdminId: ids.admin,
        authUserId: ids.auth,
        role: "super_admin",
        status: "active",
      },
    });
    mocks.transaction.mockImplementation(async (callback) =>
      callback("trusted-tx"),
    );
    mocks.writeAudit.mockResolvedValue("event-id");
  });

  it("authorizes before transaction and writes success Audit before returning", async () => {
    const context = await requireActivePlatformAdmin();
    const mutate = vi.fn().mockResolvedValue({
      result: { workspaceId: ids.workspace },
      audit: { targetWorkspaceId: ids.workspace, requestId: "request-atomic" },
    });
    await expect(
      executeAuditedPlatformWorkspaceMutation(context, "create", mutate),
    ).resolves.toEqual({ workspaceId: ids.workspace });
    expect(mutate).toHaveBeenCalledWith("trusted-tx");
    expect(mocks.writeAudit).toHaveBeenCalledWith(
      "trusted-tx",
      context,
      expect.objectContaining({
        action: "workspace.created",
        outcome: "success",
        targetWorkspaceId: ids.workspace,
      }),
    );
  });

  it("rejects the transaction result when Audit writing fails", async () => {
    const context = await requireActivePlatformAdmin();
    mocks.writeAudit.mockRejectedValue(new Error("audit failed"));
    await expect(
      executeAuditedPlatformWorkspaceMutation(context, "suspend", async () => ({
        result: "must-not-commit",
        audit: {
          targetWorkspaceId: ids.workspace,
          requestId: "request-rollback",
        },
      })),
    ).rejects.toThrow("audit failed");
  });

  it("does not write Audit or return success when mutation fails", async () => {
    const context = await requireActivePlatformAdmin();
    await expect(
      executeAuditedPlatformWorkspaceMutation(context, "activate", async () => {
        throw new Error("mutation failed");
      }),
    ).rejects.toThrow("mutation failed");
    expect(mocks.writeAudit).not.toHaveBeenCalled();
  });

  it("denies a forged tenant context before starting a transaction", async () => {
    await expect(
      executeAuditedPlatformWorkspaceMutation(
        {
          role: "owner",
          status: "active",
          capabilities: ["platform.workspaces.create"],
        } as never,
        "create",
        async () => ({
          result: "forbidden",
          audit: { targetWorkspaceId: ids.workspace, requestId: "attacker" },
        }),
      ),
    ).rejects.toBeDefined();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
