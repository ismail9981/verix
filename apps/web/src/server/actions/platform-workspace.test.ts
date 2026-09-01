import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformCapability: vi.fn(),
  readSummaries: vi.fn(),
  logActionError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../auth/platform-authorize", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../auth/platform-authorize")>();
  return {
    ...original,
    requirePlatformCapability: mocks.requirePlatformCapability,
  };
});
vi.mock("../services/platform-workspace.service", () => ({
  readPlatformWorkspaceSummaries: mocks.readSummaries,
}));
vi.mock("../observability/request-context", () => ({
  logActionError: mocks.logActionError,
}));

import { PlatformAuthorizationError } from "../auth/platform-authorize";
import { PlatformServiceError } from "../services/platform-errors";
import { readPlatformWorkspacesAction } from "./platform-workspace";

const trustedContext = Object.freeze({ role: "super_admin" });

describe("C3 Platform Workspace Server Action boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["unauthenticated", "UNAUTHENTICATED", "UNAUTHENTICATED"],
    ["no-membership user", "NOT_PLATFORM_ADMIN", "UNAUTHORIZED"],
    ["Workspace Owner", "NOT_PLATFORM_ADMIN", "UNAUTHORIZED"],
    ["Workspace Manager", "NOT_PLATFORM_ADMIN", "UNAUTHORIZED"],
    ["Workspace Employee", "NOT_PLATFORM_ADMIN", "UNAUTHORIZED"],
    ["Support Admin", "PLATFORM_CAPABILITY_DENIED", "UNAUTHORIZED"],
    ["suspended Super Admin", "PLATFORM_ADMIN_SUSPENDED", "UNAUTHORIZED"],
  ] as const)(
    "fails a direct invocation by %s closed",
    async (_actor, authorizationCode, resultCode) => {
      mocks.requirePlatformCapability.mockRejectedValue(
        new PlatformAuthorizationError(authorizationCode),
      );
      await expect(readPlatformWorkspacesAction({})).resolves.toMatchObject({
        status: "error",
        code: resultCode,
      });
      expect(mocks.readSummaries).not.toHaveBeenCalled();
    },
  );

  it("authorizes before rejecting forged identity, role, and capability input", async () => {
    mocks.requirePlatformCapability.mockRejectedValue(
      new PlatformAuthorizationError("NOT_PLATFORM_ADMIN"),
    );
    const forged = {
      platformAdminId: "attacker-admin",
      role: "super_admin",
      capability: "platform.workspaces.read",
      activeWorkspaceId: "stale-owner-workspace",
    };
    await expect(readPlatformWorkspacesAction(forged)).resolves.toMatchObject({
      status: "error",
      code: "UNAUTHORIZED",
    });
    expect(mocks.requirePlatformCapability).toHaveBeenCalledWith(
      "platform.workspaces.read",
    );
    expect(mocks.readSummaries).not.toHaveBeenCalled();
  });

  it("strictly rejects forged fields after a legitimate Super Admin authorization", async () => {
    mocks.requirePlatformCapability.mockResolvedValue(trustedContext);
    await expect(
      readPlatformWorkspacesAction({ role: "super_admin" }),
    ).resolves.toEqual({
      status: "error",
      code: "INVALID_INPUT",
      message: "The submitted input is invalid.",
    });
    expect(mocks.readSummaries).not.toHaveBeenCalled();
  });

  it("calls the authorized read service and returns its safe DTO", async () => {
    const summaries = Object.freeze([
      {
        id: "workspace-a",
        name: "Workspace A",
        status: "active",
        createdAt: "2026-08-31T08:00:00.000Z",
      },
    ]);
    mocks.requirePlatformCapability.mockResolvedValue(trustedContext);
    mocks.readSummaries.mockResolvedValue(summaries);
    await expect(readPlatformWorkspacesAction({})).resolves.toEqual({
      status: "success",
      data: summaries,
    });
    expect(mocks.readSummaries).toHaveBeenCalledWith(trustedContext);
  });

  it.each(["INVALID_INPUT", "NOT_FOUND", "CONFLICT", "INTERNAL"] as const)(
    "returns the safe %s service error model without details",
    async (code) => {
      mocks.requirePlatformCapability.mockResolvedValue(trustedContext);
      mocks.readSummaries.mockRejectedValue(new PlatformServiceError(code));
      const result = await readPlatformWorkspacesAction({});
      expect(result).toMatchObject({ status: "error", code });
      expect(JSON.stringify(result)).not.toContain("SQL");
      expect(JSON.stringify(result)).not.toContain("platformAdminId");
    },
  );

  it("logs an unexpected failure but returns only a generic internal result", async () => {
    mocks.requirePlatformCapability.mockResolvedValue(trustedContext);
    mocks.readSummaries.mockRejectedValue(
      new Error("SQL password=secret stack trace"),
    );
    const result = await readPlatformWorkspacesAction({});
    expect(result).toEqual({
      status: "error",
      code: "INTERNAL",
      message: "The operation could not be completed.",
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(mocks.logActionError).toHaveBeenCalledOnce();
  });
});
