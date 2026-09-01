import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResolution: vi.fn(),
  select: vi.fn(),
  rows: [] as Array<{
    id: string;
    name: string;
    status: "active" | "suspended";
    createdAt: Date;
    ownerId?: string;
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
import { hasCapability, requireCapability } from "../auth/capabilities";
import {
  PLATFORM_WORKSPACE_MUTATIONS,
  assertPlatformWorkspaceMutation,
  readPlatformWorkspaceSummaries,
} from "./platform-workspace.service";

const identity = {
  platformAdminId: "c3100000-0000-4000-8000-000000000001",
  authUserId: "c3200000-0000-4000-8000-000000000001",
  status: "active" as const,
};

function active(role: "super_admin" | "support_admin") {
  return {
    state: "ACTIVE_PLATFORM_ADMIN" as const,
    identity: { ...identity, role },
  };
}

describe("C3 Platform Workspace service boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows = [];
    mocks.select.mockImplementation((fields: unknown) => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async (limit: number) => {
              expect(limit).toBe(100);
              return mocks.rows;
            },
          }),
        }),
      }),
      fields,
    }));
  });

  it("returns only the four approved Workspace summary fields", async () => {
    mocks.getResolution.mockResolvedValue(active("super_admin"));
    mocks.rows = [
      {
        id: "c3300000-0000-4000-8000-000000000001",
        name: "Safe Workspace",
        status: "suspended",
        createdAt: new Date("2026-08-31T08:00:00.000Z"),
        ownerId: "must-not-leak",
      },
    ];
    const context = await requirePlatformCapability("platform.workspaces.read");
    const result = await readPlatformWorkspaceSummaries(context);
    expect(result).toEqual([
      {
        id: "c3300000-0000-4000-8000-000000000001",
        name: "Safe Workspace",
        status: "suspended",
        createdAt: "2026-08-31T08:00:00.000Z",
      },
    ]);
    expect(result[0]).not.toHaveProperty("ownerId");
    expect(
      Object.keys(mocks.select.mock.calls[0]![0] as object).sort(),
    ).toEqual(["createdAt", "id", "name", "status"]);
  });

  it("denies Support Admin before trusted DB access", async () => {
    mocks.getResolution.mockResolvedValue(active("support_admin"));
    const context = await requireActivePlatformAdmin();
    await expect(readPlatformWorkspaceSummaries(context)).rejects.toMatchObject(
      {
        code: "PLATFORM_CAPABILITY_DENIED",
      },
    );
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it.each(["owner", "manager", "employee"])(
    "denies a forged Workspace %s service context before DB access",
    async (role) => {
      await expect(
        readPlatformWorkspaceSummaries({
          role,
          status: "active",
          capabilities: ["platform.workspaces.read"],
        } as never),
      ).rejects.toMatchObject({ code: "PLATFORM_CAPABILITY_DENIED" });
      expect(mocks.select).not.toHaveBeenCalled();
    },
  );

  it.each(PLATFORM_WORKSPACE_MUTATIONS)(
    "allows active Super Admin into the %s mutation authorization path",
    async (operation) => {
      mocks.getResolution.mockResolvedValue(active("super_admin"));
      const context = await requireActivePlatformAdmin();
      expect(() =>
        assertPlatformWorkspaceMutation(context, operation),
      ).not.toThrow();
    },
  );

  it.each(PLATFORM_WORKSPACE_MUTATIONS)(
    "denies active Support Admin from the %s mutation path",
    async (operation) => {
      mocks.getResolution.mockResolvedValue(active("support_admin"));
      const context = await requireActivePlatformAdmin();
      expect(() =>
        assertPlatformWorkspaceMutation(context, operation),
      ).toThrow();
    },
  );

  it("fails unknown mutation operation closed without DB access", async () => {
    mocks.getResolution.mockResolvedValue(active("super_admin"));
    const context = await requireActivePlatformAdmin();
    expect(() =>
      assertPlatformWorkspaceMutation(context, "generic_admin_query" as never),
    ).toThrow();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it.each([
    ["unauthenticated", { state: "UNAUTHENTICATED" }],
    ["no-membership tenant", { state: "NOT_PLATFORM_ADMIN" }],
    [
      "Workspace Owner",
      { state: "NOT_PLATFORM_ADMIN", workspaceRole: "owner" },
    ],
    [
      "Workspace Manager",
      { state: "NOT_PLATFORM_ADMIN", workspaceRole: "manager" },
    ],
    [
      "Workspace Employee",
      { state: "NOT_PLATFORM_ADMIN", workspaceRole: "employee" },
    ],
  ])(
    "cannot mint a Platform service context: %s",
    async (_label, resolution) => {
      mocks.getResolution.mockResolvedValue(resolution);
      await expect(
        requirePlatformCapability("platform.workspaces.read"),
      ).rejects.toBeDefined();
      expect(mocks.select).not.toHaveBeenCalled();
    },
  );

  it("keeps both capability registries runtime-separated", () => {
    expect(
      hasCapability({ role: "owner" }, "platform.workspaces.read" as never),
    ).toBe(false);
    expect(() =>
      requireCapability({ role: "owner" }, "platform.workspaces.read" as never),
    ).toThrow();
  });
});
